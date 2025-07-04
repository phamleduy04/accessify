export interface SpotifyToken {
	accessToken: string;
	accessTokenExpirationTimestampMs: number;
	clientId?: string;
	isAnonymous?: boolean;
	[key: string]: unknown;
}

export interface TokenProxy {
	type: string;
	fetch: () => Promise<SpotifyToken>;
	readonly data: SpotifyToken | undefined;
	valid(): boolean;
	refresh(): Promise<SpotifyToken>;
}
