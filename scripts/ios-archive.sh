#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

CONFIGURATION="${IOS_CONFIGURATION:-Release}"
ARCHIVE_PATH="${IOS_ARCHIVE_PATH:-$IOS_ROOT_DIR/build/archive/OnTrack.xcarchive}"
MARKETING_VERSION="${IOS_MARKETING_VERSION:-0.1.0}"
BUILD_NUMBER="${IOS_BUILD_NUMBER:-1}"

[[ -n "${APPLE_TEAM_ID:-}" ]] || ios_die "APPLE_TEAM_ID is required for signing an iOS archive."
ios_set_app_store_auth_args
ios_set_provisioning_args

mkdir -p "$(dirname "$ARCHIVE_PATH")"

XCODEBUILD_ARGS=(
    archive
    -project "$IOS_PROJECT_PATH"
    -scheme "$IOS_SCHEME_NAME"
    -configuration "$CONFIGURATION"
    -destination "generic/platform=iOS"
    -archivePath "$ARCHIVE_PATH"
    "${IOS_PROVISIONING_ARGS[@]}"
    "${APP_STORE_AUTH_ARGS[@]}"
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID"
    PRODUCT_BUNDLE_IDENTIFIER="$IOS_BUNDLE_ID_VALUE"
    MARKETING_VERSION="$MARKETING_VERSION"
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
)

xcodebuild "${XCODEBUILD_ARGS[@]}"

echo "Archive written to $ARCHIVE_PATH"
