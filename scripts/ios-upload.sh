#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

ARCHIVE_PATH="${IOS_ARCHIVE_PATH:-$IOS_ROOT_DIR/build/archive/OnTrack.xcarchive}"
EXPORT_PATH="${IOS_EXPORT_PATH:-$IOS_ROOT_DIR/build/export}"
IOS_EXPORT_METHOD_VALUE="${IOS_EXPORT_METHOD:-app-store-connect}"
IOS_EXPORT_DESTINATION_VALUE="upload"
IOS_SIGNING_STYLE_VALUE="${IOS_SIGNING_STYLE:-automatic}"
IOS_STRIP_SWIFT_SYMBOLS_VALUE="${IOS_STRIP_SWIFT_SYMBOLS:-true}"
IOS_UPLOAD_SYMBOLS_VALUE="${IOS_UPLOAD_SYMBOLS:-true}"

[[ -d "$ARCHIVE_PATH" ]] || ios_die "Archive not found at $ARCHIVE_PATH. Run bun run ios:archive first."
[[ -n "${APPLE_TEAM_ID:-}" ]] || ios_die "APPLE_TEAM_ID is required for uploading an iOS archive."

ios_set_app_store_auth_args
ios_set_provisioning_args

TMP_DIR="$(mktemp -d)"
EXPORT_OPTIONS_PLIST="$TMP_DIR/ExportOptions.plist"
trap 'rm -rf "$TMP_DIR"' EXIT

ios_write_export_options_plist "$EXPORT_OPTIONS_PLIST"
mkdir -p "$EXPORT_PATH"

XCODEBUILD_ARGS=(
    -exportArchive
    -archivePath "$ARCHIVE_PATH"
    -exportPath "$EXPORT_PATH"
    -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
    "${IOS_PROVISIONING_ARGS[@]}"
    "${APP_STORE_AUTH_ARGS[@]}"
)

xcodebuild "${XCODEBUILD_ARGS[@]}"

echo "Upload completed from $ARCHIVE_PATH"
