#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${IOS_PROJECT:-$ROOT_DIR/apps/ios/OnTrack.xcodeproj}"
SCHEME="${IOS_SCHEME:-OnTrack}"
CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-$ROOT_DIR/build/DeviceDerivedData}"
BUNDLE_ID="${IOS_BUNDLE_ID:-dev.hsichen.ontrack}"

detect_device_id() {
    local devices_json
    devices_json="$(mktemp)"

    if ! xcrun devicectl list devices --json-output "$devices_json" >/dev/null; then
        rm -f "$devices_json"
        return 1
    fi

    local device_id
    device_id="$(
        plutil -extract result.devices.0.hardwareProperties.udid raw -o - "$devices_json" 2>/dev/null || true
    )"
    rm -f "$devices_json"

    [[ -n "$device_id" ]] && printf '%s\n' "$device_id"
}

DEVICE_ID="${IOS_DEVICE_ID:-$(detect_device_id)}"
if [[ -z "$DEVICE_ID" ]]; then
    echo "No connected iOS device found. Connect one, or set IOS_DEVICE_ID." >&2
    exit 1
fi

DESTINATION="${IOS_DESTINATION:-id=$DEVICE_ID}"
APP_PATH="${IOS_APP_PATH:-$DERIVED_DATA_PATH/Build/Products/$CONFIGURATION-iphoneos/$SCHEME.app}"

PROVISIONING_ARGS=()
if [[ "${IOS_ALLOW_PROVISIONING_UPDATES:-1}" != "0" ]]; then
    PROVISIONING_ARGS=(-allowProvisioningUpdates)
fi

echo "Building $SCHEME for device $DEVICE_ID..."
xcodebuild \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -sdk iphoneos \
    -destination "$DESTINATION" \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    "${PROVISIONING_ARGS[@]}" \
    build

if [[ ! -d "$APP_PATH" ]]; then
    echo "Built app not found at $APP_PATH." >&2
    echo "Set IOS_APP_PATH if the product name differs from the scheme." >&2
    exit 1
fi

echo "Installing $APP_PATH..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

if [[ "${IOS_SKIP_LAUNCH:-0}" == "1" ]]; then
    echo "Installed $BUNDLE_ID on $DEVICE_ID."
    exit 0
fi

LAUNCH_ENV_ARGS=()
if [[ "${IOS_MOCK_DATA:-0}" == "1" ]]; then
    if [[ "$CONFIGURATION" != "Debug" ]]; then
        echo "IOS_MOCK_DATA=1 requires IOS_CONFIGURATION=Debug." >&2
        exit 1
    fi

    LAUNCH_ENV_ARGS=(--environment-variables '{"ONTRACK_MOCK_DATA":"1"}')
fi

echo "Launching $BUNDLE_ID..."
xcrun devicectl device process launch \
    --device "$DEVICE_ID" \
    --terminate-existing \
    "${LAUNCH_ENV_ARGS[@]}" \
    "$BUNDLE_ID"

echo "Updated and launched $BUNDLE_ID on $DEVICE_ID."
