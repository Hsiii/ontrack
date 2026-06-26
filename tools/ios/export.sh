#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARCHIVE_PATH="${IOS_ARCHIVE_PATH:-$ROOT_DIR/build/ios/archive/OnTrack.xcarchive}"
EXPORT_PATH="${IOS_EXPORT_PATH:-$ROOT_DIR/build/ios/export}"
EXPORT_METHOD="${IOS_EXPORT_METHOD:-app-store-connect}"
EXPORT_DESTINATION="${IOS_EXPORT_DESTINATION:-export}"
SIGNING_STYLE="${IOS_SIGNING_STYLE:-automatic}"
STRIP_SWIFT_SYMBOLS="${IOS_STRIP_SWIFT_SYMBOLS:-true}"
UPLOAD_SYMBOLS="${IOS_UPLOAD_SYMBOLS:-true}"

if [[ ! -d "$ARCHIVE_PATH" ]]; then
    echo "Archive not found at $ARCHIVE_PATH. Run tools/ios/archive.sh first." >&2
    exit 1
fi

AUTH_ARGS=()
if [[ -n "${ASC_KEY_PATH:-}" || -n "${ASC_KEY_ID:-}" || -n "${ASC_ISSUER_ID:-}" ]]; then
    if [[ -z "${ASC_KEY_PATH:-}" || -z "${ASC_KEY_ID:-}" || -z "${ASC_ISSUER_ID:-}" ]]; then
        echo "ASC_KEY_PATH, ASC_KEY_ID, and ASC_ISSUER_ID must be set together." >&2
        exit 1
    fi

    AUTH_ARGS=(
        -authenticationKeyPath "$ASC_KEY_PATH"
        -authenticationKeyID "$ASC_KEY_ID"
        -authenticationKeyIssuerID "$ASC_ISSUER_ID"
    )
fi

PROVISIONING_ARGS=()
if [[ "${IOS_ALLOW_PROVISIONING_UPDATES:-1}" != "0" ]]; then
    PROVISIONING_ARGS=(-allowProvisioningUpdates)
fi

TMP_DIR="$(mktemp -d)"
EXPORT_OPTIONS_PLIST="$TMP_DIR/ExportOptions.plist"
trap 'rm -rf "$TMP_DIR"' EXIT

TEAM_ID_BLOCK=""
if [[ -n "${APPLE_TEAM_ID:-}" ]]; then
    TEAM_ID_BLOCK="
    <key>teamID</key>
    <string>${APPLE_TEAM_ID}</string>"
fi

cat >"$EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>${EXPORT_METHOD}</string>
    <key>destination</key>
    <string>${EXPORT_DESTINATION}</string>
    <key>signingStyle</key>
    <string>${SIGNING_STYLE}</string>${TEAM_ID_BLOCK}
    <key>stripSwiftSymbols</key>
    <${STRIP_SWIFT_SYMBOLS}/>
    <key>uploadSymbols</key>
    <${UPLOAD_SYMBOLS}/>
</dict>
</plist>
PLIST

mkdir -p "$EXPORT_PATH"

XCODEBUILD_ARGS=(
    -exportArchive
    -archivePath "$ARCHIVE_PATH"
    -exportPath "$EXPORT_PATH"
    -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
)

if [[ ${#PROVISIONING_ARGS[@]} -gt 0 ]]; then
    XCODEBUILD_ARGS+=("${PROVISIONING_ARGS[@]}")
fi

if [[ ${#AUTH_ARGS[@]} -gt 0 ]]; then
    XCODEBUILD_ARGS+=("${AUTH_ARGS[@]}")
fi

xcodebuild "${XCODEBUILD_ARGS[@]}"

echo "Export completed at $EXPORT_PATH"
