# Release

OnTrack is a Bun monorepo with the web app in `apps/web`, the native iOS app in `apps/ios`, and the Cloudflare Worker at the repo root.

## Web

Build and export the static web app:

```sh
bun run export:web
```

Deploy the web app plus Worker to Cloudflare:

```sh
bun run release:web
```

`wrangler.jsonc` serves assets from `apps/web/out`.

## iOS Signing

The iOS target uses automatic signing. Set these variables before archiving:

```sh
export APPLE_TEAM_ID=ABCDE12345
export IOS_BUNDLE_ID=dev.hsichen.ontrack
export IOS_MARKETING_VERSION=0.1.0
export IOS_BUILD_NUMBER=1
```

For CI or App Store Connect API-key authentication, also set:

```sh
export ASC_KEY_PATH=/secure/path/AuthKey_XXXXXXXXXX.p8
export ASC_KEY_ID=XXXXXXXXXX
export ASC_ISSUER_ID=00000000-0000-0000-0000-000000000000
```

Archive and export an App Store Connect IPA:

```sh
bun run ios:release
```

Useful variants:

```sh
bun run ios:archive
bun run ios:export
IOS_EXPORT_METHOD=release-testing bun run ios:export
IOS_EXPORT_DESTINATION=upload bun run ios:release
```

`IOS_EXPORT_METHOD` accepts the current Xcode export method names, including `app-store-connect`, `release-testing`, and `debugging`.

## Local Checks

Run repo checks:

```sh
bun run build
bun run lint
bun run ios:check
```

Run an unsigned simulator build when an iOS simulator runtime is installed:

```sh
bun run ios:build
```

If `xcodebuild` reports that the iOS platform is not installed, install it from Xcode Settings > Components or use `xcodebuild -downloadPlatform iOS`.
