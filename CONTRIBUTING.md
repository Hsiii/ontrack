# Contributing

Thanks for taking the time to improve OnTrack.

## Project Scope

OnTrack is a Taiwan railway schedule app with three main surfaces:

- `apps/ios`: native iOS app
- `apps/web`: web app and public documentation site
- `apps/worker`: Cloudflare Worker API and cache layer

The official app is published by Hsi. Forks and redistributions should use their
own app name, icons, screenshots, bundle identifier, support links, privacy
policy, backend, and App Store listing.

## Development

Use Bun for JavaScript and TypeScript work:

```sh
bun install
bun run dev
bun run build
bun run lint
```

For iOS development, the project scripts wrap common Xcode workflows:

```sh
bun run ios
bun run ios:simulator
bun run ios:check
```

## Worker Setup

The tracked Worker config contains the development target and the maintainer's
production environment. Before deploying a fork:

1. Create your own Cloudflare D1 database.
2. Replace the account, route, and D1 identifiers under `env.production` in
   `apps/worker/wrangler.jsonc`.
3. Set Worker secrets for production:

```sh
wrangler secret put TDX_CLIENT_ID --config apps/worker/wrangler.jsonc --env production
wrangler secret put TDX_CLIENT_SECRET --config apps/worker/wrangler.jsonc --env production
wrangler secret put REFRESH_SECRET --config apps/worker/wrangler.jsonc --env production
```

`TDX_CLIENT_ID` and `TDX_CLIENT_SECRET` are optional for development. Without
them, the Worker uses TDX Visitor Mode.

Use `bun run deploy:dev` for the tracked development config after filling its D1
placeholder. Use `bun run deploy` for the tracked production environment.

## Pull Requests

- Keep changes focused.
- Include tests or manual verification notes for behavior changes.
- Use existing code style and project conventions.
- Do not commit credentials, private `.env` files, provisioning profiles, or
  archives.
- Do not reuse OnTrack brand assets for redistributed forks.
