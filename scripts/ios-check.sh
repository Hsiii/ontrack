#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${IOS_PROJECT:-$ROOT_DIR/apps/ios/OnTrack.xcodeproj}"
SCHEME="${IOS_SCHEME:-OnTrack}"
SDK_PATH="${IOS_SIMULATOR_SDK_PATH:-$(xcrun --sdk iphonesimulator --show-sdk-path)}"
TARGET="${IOS_PARSE_TARGET:-arm64-apple-ios17.0-simulator}"

xcodebuild -list -project "$PROJECT" >/dev/null
xcrun swiftc \
    -sdk "$SDK_PATH" \
    -target "$TARGET" \
    -parse \
    "$ROOT_DIR/apps/ios/OnTrack/APIClient.swift" \
    "$ROOT_DIR/apps/ios/OnTrack/ContentView.swift" \
    "$ROOT_DIR/apps/ios/OnTrack/DestinationAutofill.swift" \
    "$ROOT_DIR/apps/ios/OnTrack/Models.swift" \
    "$ROOT_DIR/apps/ios/OnTrack/OnTrackApp.swift"

echo "iOS project and Swift parse checks passed for scheme $SCHEME."
