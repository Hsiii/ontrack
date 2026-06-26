#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${IOS_PROJECT:-$ROOT_DIR/apps/ios/OnTrack.xcodeproj}"
SCHEME="${IOS_SCHEME:-OnTrack}"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
ARCHIVE_PATH="${IOS_ARCHIVE_PATH:-$ROOT_DIR/build/ios/archive/OnTrack.xcarchive}"
BUNDLE_ID="${IOS_BUNDLE_ID:-dev.hsichen.ontrack}"
MARKETING_VERSION="${IOS_MARKETING_VERSION:-0.1.0}"
BUILD_NUMBER="${IOS_BUILD_NUMBER:-1}"

if [[ -z "${APPLE_TEAM_ID:-}" ]]; then
    echo "APPLE_TEAM_ID is required for signing an iOS archive." >&2
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

mkdir -p "$(dirname "$ARCHIVE_PATH")"

XCODEBUILD_ARGS=(
    archive
    -project "$PROJECT"
    -scheme "$SCHEME"
    -configuration "$CONFIGURATION"
    -destination "generic/platform=iOS"
    -archivePath "$ARCHIVE_PATH"
)

if [[ ${#PROVISIONING_ARGS[@]} -gt 0 ]]; then
    XCODEBUILD_ARGS+=("${PROVISIONING_ARGS[@]}")
fi

if [[ ${#AUTH_ARGS[@]} -gt 0 ]]; then
    XCODEBUILD_ARGS+=("${AUTH_ARGS[@]}")
fi

XCODEBUILD_ARGS+=(
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID"
    PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID"
    MARKETING_VERSION="$MARKETING_VERSION"
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER"
)

xcodebuild "${XCODEBUILD_ARGS[@]}"

echo "Archive written to $ARCHIVE_PATH"
