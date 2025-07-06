import playwright, {
	type Browser,
	type LaunchOptions,
	type Page,
	type Request,
} from "playwright";
import { Semaphore } from "../utils/semaphore";
import { logWithTimestamp, contextLogWithUndefined } from "../utils/logger";
import type { SpotifyToken, TokenProxy } from "../types/spotify";
import type { Context } from "hono";

export class SpotifyTokenHandler {
	public semaphore = new Semaphore();
	public cachedAccessToken: SpotifyToken | undefined = undefined;
	private refreshTimeout: NodeJS.Timeout | undefined;

	constructor() {
		// fetch initial token on startup
		this.getAccessToken()
			.then((token) => {
				this.cachedAccessToken = token;
				logWithTimestamp("info", "Initial Spotify token fetched");
			})
			.catch((err) => {
				logWithTimestamp("warn", "Failed to fetch initial Spotify token", err);
			});
	}

	private scheduleNextRefresh() {
		if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
		const token = this.cachedAccessToken;
		if (!token) return;
		const now = Date.now();
		const expiresIn = token.accessTokenExpirationTimestampMs - now;
		const refreshIn = Math.max(expiresIn + 100, 0); // refresh this trash thing 100ms after expired
		this.refreshTimeout = setTimeout(async () => {
			try {
				const release = await this.semaphore.acquire();
				try {
					const newToken = await this.getAccessToken();
					this.cachedAccessToken = newToken;
					logWithTimestamp("info", "Spotify token auto-refreshed (timeout)");
				} finally {
					release();
				}
			} catch (err) {
				logWithTimestamp("warn", "Failed to auto-refresh Spotify token", err);
			}
			this.scheduleNextRefresh();
		}, refreshIn);
	}

	public getAccessToken = async (): Promise<SpotifyToken> => {
		return new Promise<SpotifyToken>((resolve, reject) => {
			(async () => {
				const executablePath =
					process.env.BROWSER_PATH && process.env.BROWSER_PATH.trim() !== ""
						? process.env.BROWSER_PATH
						: undefined;
				const launchOptions: LaunchOptions = { headless: true };
				if (executablePath) launchOptions.executablePath = executablePath;

				const browser: Browser | undefined = await playwright.chromium
					.launch(launchOptions)
					.catch(contextLogWithUndefined.bind(null, "Failed to spawn browser"));
				if (!browser) return reject(new Error("Failed to launch browser"));

				const page: Page | undefined = await browser
					.newPage()
					.catch(contextLogWithUndefined.bind(null, "Failed to open new page"));
				if (!page) {
					await browser.close();
					return reject(new Error("Failed to open new page"));
				}

				let processedAccessTokenRequest = false;
				const timeout = setTimeout(() => {
					if (!processedAccessTokenRequest) {
						logWithTimestamp(
							"warn",
							"Deadline exceeded without processing access token request, did the endpoint change?",
						);
					}
					browser.close();
					reject(new Error("Token fetch exceeded deadline"));
				}, 15000);

				page.on("requestfinished", async (event: Request) => {
					if (!event.url().includes("/api/token")) return;
					processedAccessTokenRequest = true;
					let response: unknown;
					try {
						response = await event.response();
					} catch {
						response = null;
					}
					if (!response || !(response as Response).ok) {
						page.removeAllListeners();
						await browser.close();
						clearTimeout(timeout);
						return reject(new Error("Invalid response from Spotify."));
					}
					let json: unknown;
					try {
						json = await (response as Response).json();
					} catch {
						json = null;
					}
					if (
						json &&
						typeof json === "object" &&
						json !== null &&
						"_notes" in json
					) {
						delete (json as Record<string, unknown>)._notes;
					}
					page.removeAllListeners();
					await browser.close();
					clearTimeout(timeout);
					// Set token dan jadwalkan refresh otomatis
					this.cachedAccessToken = json as SpotifyToken;
					this.scheduleNextRefresh();
					resolve(json as SpotifyToken);
				});

				page.goto("https://open.spotify.com/").catch((err: unknown) => {
					if (!processedAccessTokenRequest) {
						browser.close();
						clearTimeout(timeout);
						reject(new Error(`Failed to goto URL: ${err}`));
					}
				});
			})();
		});
	};

	public honoHandler = async (c: Context): Promise<Response> => {
		const isForce = ["1", "yes", "true"].includes(
			(c.req.query("force") || "").toLowerCase(),
		);
		// i have no idea how to make this work
		let ip = c.req.header("x-forwarded-for");
		if (!ip) {
			const raw = c.req.raw;
			if (typeof raw === "object" && raw && "socket" in raw) {
				const socket = (raw as { socket?: { remoteAddress?: string } }).socket;
				if (socket && typeof socket.remoteAddress === "string") {
					ip = socket.remoteAddress;
				}
			}
		}
		ip = ip || "unknown";
		const userAgent = c.req.header("user-agent") ?? "no ua";
		const start = Date.now();
		const result = await this.handleTokenRequest(c, isForce);
		const elapsed = Date.now() - start;
		logWithTimestamp(
			"info",
			`Handled Spotify Token request from IP: ${ip}, UA: ${userAgent} (force: ${isForce}) in ${elapsed}ms`,
		);
		return result;
	};

	private handleTokenRequest = async (
		c: Context,
		isForce: boolean,
	): Promise<Response> => {
		const thisHandler = this;
		const token: TokenProxy = {
			type: "cachedAccessToken",
			fetch: this.getAccessToken,
			get data() {
				return thisHandler.cachedAccessToken;
			},
			valid() {
				return (
					(this.data?.accessTokenExpirationTimestampMs || 0) - 10000 >
					Date.now()
				);
			},
			async refresh() {
				const data = await this.fetch();
				thisHandler.cachedAccessToken = data;
				return data;
			},
		};

		if (!isForce && token.valid()) {
			return c.json(token.data, 200);
		}

		const release = await this.semaphore.acquire();
		try {
			if (!isForce && token.valid()) {
				return c.json(token.data, 200);
			} else {
				const refreshed = await token.refresh();
				return c.json(refreshed, 200);
			}
		} catch (e) {
			logWithTimestamp("error", e);
			return c.json({}, 500);
		} finally {
			release();
		}
	};
}
