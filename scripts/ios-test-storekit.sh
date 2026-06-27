#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

STOREKIT_TEMPLATE="$IOS_ROOT_DIR/apps/ios/OnTrack/OnTrack.storekit"
STOREKIT_CONFIG="$IOS_ROOT_DIR/apps/ios/OnTrack/OnTrack.local.storekit"
SCHEME_PATH="$IOS_ROOT_DIR/apps/ios/OnTrack.xcodeproj/xcshareddata/xcschemes/OnTrack.xcscheme"
PRODUCT_ID="ontrack.supporter_pack"

OPEN_XCODE=1
RESET_INSTALLED_APP=1
DEVICECTL_TIMEOUT_SECONDS=8

detect_device_id_for_storekit_reset() {
    if [[ -n "${IOS_DEVICE_ID:-}" ]]; then
        echo "$IOS_DEVICE_ID"
        return 0
    fi

    local devices_json
    devices_json="$(mktemp)"
    if ! xcrun devicectl list devices --timeout "$DEVICECTL_TIMEOUT_SECONDS" --json-output "$devices_json" >/dev/null 2>&1; then
        rm -f "$devices_json"
        return 1
    fi

    plutil -extract result.devices.0.hardwareProperties.udid raw -o - "$devices_json" 2>/dev/null || true
    rm -f "$devices_json"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-open)
            OPEN_XCODE=0
            ;;
        --keep-installed)
            RESET_INSTALLED_APP=0
            ;;
        *)
            ios_die "Usage: scripts/ios-test-storekit.sh [--no-open] [--keep-installed]"
            ;;
    esac
    shift
done

[[ -f "$STOREKIT_TEMPLATE" ]] || ios_die "Missing StoreKit template: $STOREKIT_TEMPLATE"
[[ -f "$SCHEME_PATH" ]] || ios_die "Missing shared scheme: $SCHEME_PATH"

python3 - "$STOREKIT_TEMPLATE" "$STOREKIT_CONFIG" <<'PY'
import json
import sys
import uuid

template_path, output_path = sys.argv[1:]
with open(template_path, "r", encoding="utf-8") as template_file:
    config = json.load(template_file)

config["identifier"] = f"ONTRACK_LOCAL_STOREKIT_{uuid.uuid4().hex.upper()}"

with open(output_path, "w", encoding="utf-8") as output_file:
    json.dump(config, output_file, ensure_ascii=False, indent=2)
    output_file.write("\n")
PY

python3 -m json.tool "$STOREKIT_CONFIG" >/dev/null
touch "$STOREKIT_CONFIG" "$SCHEME_PATH"

python3 - "$STOREKIT_CONFIG" "$PRODUCT_ID" <<'PY'
import json
import sys

config_path, product_id = sys.argv[1:]
with open(config_path, "r", encoding="utf-8") as config_file:
    config = json.load(config_file)

if not any(product.get("productID") == product_id for product in config.get("products", [])):
    raise SystemExit(f"StoreKit config does not include product ID {product_id}.")
PY

grep -q "OnTrack.local.storekit" "$SCHEME_PATH" \
    || ios_die "OnTrack scheme is not linked to OnTrack.local.storekit."

RESET_MESSAGE="skipped"
if [[ "$RESET_INSTALLED_APP" == "1" ]]; then
    DEVICE_ID="$(detect_device_id_for_storekit_reset || true)"

    if [[ -n "$DEVICE_ID" ]]; then
        if xcrun devicectl device uninstall app --timeout "$DEVICECTL_TIMEOUT_SECONDS" --device "$DEVICE_ID" "$IOS_BUNDLE_ID_VALUE" >/dev/null 2>&1; then
            RESET_MESSAGE="uninstalled $IOS_BUNDLE_ID_VALUE from $DEVICE_ID"
        else
            RESET_MESSAGE="attempted uninstall of $IOS_BUNDLE_ID_VALUE on $DEVICE_ID, then continued"
        fi
    else
        RESET_MESSAGE="no connected device detected within ${DEVICECTL_TIMEOUT_SECONDS}s"
    fi
fi

echo "StoreKit config is ready:"
echo "  Product: $PRODUCT_ID"
echo "  Config:  $STOREKIT_CONFIG"
echo "  Scheme:  $SCHEME_PATH"
echo "  Flow:    generated fresh, starts unpurchased, then unlocks after local purchase"
echo "  App:     $RESET_MESSAGE"
echo
echo "To test on iPhone:"
echo "  1. Use the opened Xcode project"
echo "  2. Select the OnTrack scheme and your iPhone"
echo "  3. Run from Xcode"
echo "  4. Open Settings > Support OnTrack"

if [[ "$OPEN_XCODE" == "1" ]]; then
    echo
    echo "Opening $IOS_PROJECT_PATH..."
    open "$IOS_PROJECT_PATH"
fi
