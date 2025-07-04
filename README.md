# Accessify

> **Credit:** This project is based on [devoxin/anonify](https://github.com/devoxin/anonify) with refactoring and adaptation for LavaSrc and general Spotify access token needs.

A simple REST API to generate and cache anonymous Spotify access tokens using Playwright. This project is primarily designed for use as a custom anonymous token endpoint for [LavaSrc](https://github.com/topi314/LavaSrc) on Lavalink, but can be used in any application or service that needs a fresh Spotify access token.

## Features
- Generate anonymous Spotify access tokens (browser automation, Playwright)
- Designed for seamless integration with LavaSrc/Lavalink (customAnonymousTokenEndpoint)
- Can be used by any service needing a Spotify access token
- Token caching with force refresh support
- Concurrency-safe (Semaphore)
- Fast REST API (Hono framework)
- TypeScript, modular and maintainable structure

## Requirements
- Node.js 18+
- Playwright browsers (see below)

## Install dependencies

```bash
bun install # or npm install
```

## Install Playwright browsers

```bash
npx playwright install
# or only Chromium:
npx playwright install chromium
```

## Build & Run (Production)

```bash
bun run start
# or
npm run start
```

## Run (Development, with tsx)

```bash
npx tsx src/server.ts
```

## API Usage

- **GET /spotifytoken**
  - Returns a cached Spotify access token (auto-refresh if expired)
  - Query param: `force=1` to force refresh token

Example:
```bash
curl http://localhost:3000/spotifytoken
curl http://localhost:3000/spotifytoken?force=1
```

## Integration: LavaSrc Custom Anonymous Token Endpoint

This API can be used as a custom anonymous token endpoint for [LavaSrc](https://github.com/topi314/LavaSrc) and Lavalink (see [LavaSrc PR #286](https://github.com/topi314/LavaSrc/pull/286)).

**Example LavaSrc on Lavalink config:**
```yaml
spotify:
  preferAnonymousToken: true
  customAnonymousTokenEndpoint: "http://localhost:3000/spotifytoken"
```

## Notes
- For deployment on server/CI, make sure Playwright browsers are installed (`npx playwright install chromium`).
- For custom Chromium, set `executablePath` in the handler.
- Request logs include IP and user-agent.

---

This project was created using Bun & Node.js. See [Bun](https://bun.sh) and [Hono](https://hono.dev/).
