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

Short iOS aliases:

```sh
bun run ic   # ios:check
bun run ib   # ios:build
bun run ia   # ios:archive
bun run ie   # ios:export
bun run ir   # ios:release
bun run idv  # install and launch on a connected device
bun run idm  # install and launch on a connected device with mock data
```

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

## App Store Release Next Steps

Use Apple's current App Store Connect flow as the source of truth:

- Apple Developer Program: https://developer.apple.com/programs/
- App Store Connect workflow: https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/
- Create an app record: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/
- Upload builds: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- TestFlight overview: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- App privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Export compliance: https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/
- Screenshots: https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/
- Submit for review: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/
- Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

Suggested order:

1. Confirm the Apple Developer Program account, App Store Connect access, signed agreements, and tax/banking/compliance status.
2. Register or confirm the bundle ID, then create the App Store Connect app record before uploading a build. Use the same `IOS_BUNDLE_ID` configured for signing.
3. Prepare product metadata: name, subtitle, keywords, description, category, age rating, support URL, privacy policy URL, review contact, and any reviewer notes.
4. Complete privacy and compliance answers. OnTrack uses location and network access, so verify the App Privacy answers and export-compliance/encryption answers before review.
5. Capture App Store screenshots for the device classes this target supports. Apple currently accepts one to ten screenshots per required display set.
6. Run local checks, increment version/build numbers, then archive and upload:

    ```sh
    bun run build
    bun run lint
    bun run ios:check
    IOS_EXPORT_DESTINATION=upload bun run ios:release
    ```

7. Use TestFlight for internal testing first. Resolve any Missing Compliance or processing issues before inviting external testers or submitting to App Review.
8. Select the uploaded build for the app version, add it for review, and submit. Review the App Review Guidelines before the first submission.
