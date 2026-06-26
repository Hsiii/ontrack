#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="${IOS_PROJECT:-$ROOT_DIR/apps/ios/OnTrack.xcodeproj}"
SCHEME="${IOS_SCHEME:-OnTrack}"
CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
SDK="${IOS_SDK:-iphonesimulator}"
DESTINATION="${IOS_DESTINATION:-generic/platform=iOS Simulator}"
DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-$ROOT_DIR/build/ios/DerivedData}"

xcodebuild \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -sdk "$SDK" \
    -destination "$DESTINATION" \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    CODE_SIGNING_ALLOWED=NO \
    build
