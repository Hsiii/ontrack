#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

SDK_PATH="${IOS_SIMULATOR_SDK_PATH:-$(xcrun --sdk iphonesimulator --show-sdk-path)}"
TARGET="${IOS_PARSE_TARGET:-arm64-apple-ios17.0-simulator}"

xcodebuild -list -project "$IOS_PROJECT_PATH" >/dev/null
xcrun swiftc \
    -sdk "$SDK_PATH" \
    -target "$TARGET" \
    -parse \
    "$IOS_ROOT_DIR/apps/ios/OnTrack/APIClient.swift" \
    "$IOS_ROOT_DIR/apps/ios/OnTrack/ContentView.swift" \
    "$IOS_ROOT_DIR/apps/ios/OnTrack/DestinationAutofill.swift" \
    "$IOS_ROOT_DIR/apps/ios/OnTrack/Models.swift" \
    "$IOS_ROOT_DIR/apps/ios/OnTrack/OnTrackApp.swift"

echo "iOS project and Swift parse checks passed for scheme $IOS_SCHEME_NAME."
