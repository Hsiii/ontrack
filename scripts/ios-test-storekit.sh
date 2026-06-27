#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

STOREKIT_CONFIG="$IOS_ROOT_DIR/apps/ios/OnTrack/OnTrack.storekit"
SCHEME_PATH="$IOS_ROOT_DIR/apps/ios/OnTrack.xcodeproj/xcshareddata/xcschemes/OnTrack.xcscheme"
PRODUCT_ID="ontrack.supporter_pack"

OPEN_XCODE=0
if [[ "${1:-}" == "--open" ]]; then
    OPEN_XCODE=1
elif [[ $# -gt 0 ]]; then
    ios_die "Usage: scripts/ios-test-storekit.sh [--open]"
fi

[[ -f "$STOREKIT_CONFIG" ]] || ios_die "Missing StoreKit config: $STOREKIT_CONFIG"
[[ -f "$SCHEME_PATH" ]] || ios_die "Missing shared scheme: $SCHEME_PATH"

python3 -m json.tool "$STOREKIT_CONFIG" >/dev/null

grep -q "\"productID\" : \"$PRODUCT_ID\"" "$STOREKIT_CONFIG" \
    || ios_die "StoreKit config does not include product ID $PRODUCT_ID."

grep -q "OnTrack.storekit" "$SCHEME_PATH" \
    || ios_die "OnTrack scheme is not linked to OnTrack.storekit."

echo "StoreKit config is ready:"
echo "  Product: $PRODUCT_ID"
echo "  Config:  $STOREKIT_CONFIG"
echo "  Scheme:  $SCHEME_PATH"
echo
echo "To test on iPhone:"
echo "  1. Open $IOS_PROJECT_PATH"
echo "  2. Select the OnTrack scheme and your iPhone"
echo "  3. Run from Xcode"
echo "  4. Open Settings > Support OnTrack"

if [[ "$OPEN_XCODE" == "1" ]]; then
    open "$IOS_PROJECT_PATH"
fi
