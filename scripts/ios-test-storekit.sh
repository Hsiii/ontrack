#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

STOREKIT_TEMPLATE="$IOS_ROOT_DIR/apps/ios/OnTrack/OnTrack.storekit"
STOREKIT_CONFIG="$IOS_ROOT_DIR/apps/ios/OnTrack/OnTrack.local.storekit"
SCHEME_PATH="$IOS_ROOT_DIR/apps/ios/OnTrack.xcodeproj/xcshareddata/xcschemes/OnTrack.xcscheme"
SHARED_AUTOFILL_CONFIG="$IOS_ROOT_DIR/apps/shared/destination-autofill.json"
PRODUCT_ID="ontrack.supporter_pack"

OPEN_XCODE=1
RESET_INSTALLED_APP=1
CLEAN_XCODE_BUILD=1
ALLOW_RESET_FAILURE=0
DEVICECTL_TIMEOUT_SECONDS=30

detect_device_id_for_storekit_reset() {
    if [[ -n "${IOS_DEVICE_ID:-}" ]]; then
        echo "$IOS_DEVICE_ID"
        return 0
    fi

    IOS_DEVICECTL_TIMEOUT_SECONDS="$DEVICECTL_TIMEOUT_SECONDS" ios_detect_device_id 2>/dev/null
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-open)
            OPEN_XCODE=0
            ;;
        --keep-installed)
            RESET_INSTALLED_APP=0
            ;;
        --allow-reset-failure)
            ALLOW_RESET_FAILURE=1
            ;;
        --no-clean)
            CLEAN_XCODE_BUILD=0
            ;;
        *)
            ios_die "Usage: scripts/ios-test-storekit.sh [--no-open] [--keep-installed] [--allow-reset-failure] [--no-clean]"
            ;;
    esac
    shift
done

[[ -f "$STOREKIT_TEMPLATE" ]] || ios_die "Missing StoreKit template: $STOREKIT_TEMPLATE"
[[ -f "$SCHEME_PATH" ]] || ios_die "Missing shared scheme: $SCHEME_PATH"
[[ -f "$SHARED_AUTOFILL_CONFIG" ]] || ios_die "Missing destination autofill config: $SHARED_AUTOFILL_CONFIG"

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
touch "$IOS_ROOT_DIR/apps/ios/OnTrack/DestinationAutofill.swift"
touch "$SHARED_AUTOFILL_CONFIG"
touch "$IOS_ROOT_DIR/apps/ios/OnTrack.xcodeproj/project.pbxproj"

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
            RESET_MESSAGE="could not uninstall $IOS_BUNDLE_ID_VALUE from $DEVICE_ID within ${DEVICECTL_TIMEOUT_SECONDS}s"
            if [[ "$ALLOW_RESET_FAILURE" != "1" ]]; then
                ios_die "$RESET_MESSAGE. Unlock the iPhone, keep it connected and trusted, close OnTrack if it is running, then rerun bun run ios:store. Use --keep-installed only when you intentionally want to keep the current app state."
            fi
        fi
    else
        RESET_MESSAGE="no connected device detected within ${DEVICECTL_TIMEOUT_SECONDS}s"
    fi
fi

CLEAN_MESSAGE="skipped"
if [[ "$CLEAN_XCODE_BUILD" == "1" ]]; then
    if xcodebuild -project "$IOS_PROJECT_PATH" -scheme "$IOS_SCHEME_NAME" -configuration Debug clean >/dev/null 2>&1; then
        CLEAN_MESSAGE="cleaned Debug build products"
    else
        CLEAN_MESSAGE="clean failed; use Product > Clean Build Folder in Xcode before running"
    fi
fi

echo "StoreKit config is ready:"
echo "  Product: $PRODUCT_ID"
echo "  Config:  $STOREKIT_CONFIG"
echo "  Scheme:  $SCHEME_PATH"
echo "  Flow:    generated fresh, starts unpurchased, then unlocks after local purchase"
echo "  App:     $RESET_MESSAGE"
echo "  Build:   $CLEAN_MESSAGE"
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
