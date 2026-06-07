# OnTrack

<img alt="demo" src="https://raw.githubusercontent.com/Hsiii/OnTrack/main/public/demo.png" width="280" />

Check Taiwan Railway arrival times with zero taps.

## Features

- Real-time train schedules from [TDX](https://tdx.transportdata.tw/)
- Auto-detect nearest start station
- Auto-fill your favorite destination station
- Auto-select the next departing train
- Quick destination and arrival time sharing

## Deployment

OnTrack deploys as a Cloudflare Worker with static assets and cron triggers.
Stable TDX data is stored in Supabase so user requests can read warm snapshots
instead of fetching from TDX on Worker startup.

1. Apply `supabase/migrations/20260607000000_create_tdx_snapshots.sql`.
2. Set Cloudflare Worker secrets:

```bash
wrangler secret put TDX_CLIENT_ID
wrangler secret put TDX_CLIENT_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SECRET_KEY
wrangler secret put REFRESH_SECRET # optional, enables /api/refresh
```

3. Deploy with Bun:

```bash
bun run deploy
```

For local development, run `bun run dev:worker` and `bun run dev` in separate
terminals. Vite proxies `/api` to the Worker on `localhost:8787`.

## Install as an App

### iOS (Safari)

1. Open the app in Safari on [ontrack.hsichen.dev](https://ontrack.hsichen.dev/)
2. Tap the share button (bottom center)
3. Select "Add to Home Screen"

### Android (Chrome)

1. Open the app in Chrome on [ontrack.hsichen.dev](https://ontrack.hsichen.dev/)
2. Tap the ⋮ menu (top right)
3. Select "Add to Home screen" or "Install app"
