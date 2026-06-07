# Caching Architecture

OnTrack serves a Vite SPA and `/api/*` routes from a Cloudflare Worker. Stable
TDX payloads are persisted in Supabase so user-facing requests do not depend on
Worker instance memory or fresh TDX fetches.

## Overview

```
TDX API
  -> Cloudflare Worker scheduled refresh
  -> Supabase tdx_snapshots
  -> Cloudflare Worker /api/*
  -> Browser
```

## Snapshot Store

Supabase table: `public.tdx_snapshots`

| Key                          | Payload                          | Refresh                                                                  |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `stations`                   | App-ready TRA station list       | Daily at 00:10 and 00:30 Asia/Taipei                                     |
| `daily-timetable:YYYY-MM-DD` | TDX `TrainTimetables` array      | Daily at 00:10 and 00:30 Asia/Taipei, plus lazy fill for requested dates |
| `train-live-board`           | Train number to delay-minute map | Every 5 minutes                                                          |

The table is RLS-enabled. The public browser never reads it directly; the Worker
uses `SUPABASE_SECRET_KEY` server-side.

## Worker Cron

Cron definitions live in `wrangler.jsonc`. Cloudflare cron expressions run in
UTC, so `10 16 * * *` is 00:10 in Asia/Taipei.

| Cron          | Purpose                                                         |
| ------------- | --------------------------------------------------------------- |
| `*/5 * * * *` | Refresh live delay data with `If-Modified-Since` support        |
| `10 16 * * *` | Refresh stations plus today and tomorrow timetables             |
| `30 16 * * *` | Retry daily stable-data refresh after TDX's daily update window |

## Request Behavior

`GET /api/stations` reads the `stations` snapshot. If the database is empty, the
Worker fetches from TDX, stores the snapshot, then returns it.

`GET /api/schedule?origin={id}&dest={id}&date={yyyy-MM-dd}` reads the matching
daily timetable snapshot and filters it for the requested station order. For
today's date, it also merges the latest `train-live-board` delay snapshot.

This means normal user traffic reads from Supabase instead of TDX, avoiding the
cold-start cache miss that existed with Vercel function memory.

## HTTP Cache Headers

| Endpoint        | Header                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `/api/stations` | `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800` |
| `/api/schedule` | `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`       |

## Local Testing

Run the Worker:

```bash
bun run dev:worker
```

Run Vite in another terminal:

```bash
bun run dev
```

Vite proxies `/api` to `http://localhost:8787`.

Trigger the scheduled handler locally:

```bash
curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"
```

## Required Secrets

Set these in Cloudflare Worker secrets or local `.dev.vars`:

```bash
TDX_CLIENT_ID=your_tdx_client_id
TDX_CLIENT_SECRET=your_tdx_client_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_sb_secret_key
REFRESH_SECRET=optional_manual_refresh_secret
```
