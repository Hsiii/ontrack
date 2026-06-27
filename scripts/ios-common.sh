#!/usr/bin/env bash

APP_STORE_AUTH_ARGS=()
IOS_PROVISIONING_ARGS=()

IOS_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_PROJECT_PATH="${IOS_PROJECT:-$IOS_ROOT_DIR/apps/ios/OnTrack.xcodeproj}"
IOS_SCHEME_NAME="${IOS_SCHEME:-OnTrack}"
IOS_BUNDLE_ID_VALUE="${IOS_BUNDLE_ID:-dev.hsichen.ontrack}"

ios_die() {
    echo "$*" >&2
    exit 1
}

ios_set_app_store_auth_args() {
    APP_STORE_AUTH_ARGS=()

    if [[ -z "${ASC_KEY_PATH:-}${ASC_KEY_ID:-}${ASC_ISSUER_ID:-}" ]]; then
        return
    fi

    if [[ -z "${ASC_KEY_PATH:-}" || -z "${ASC_KEY_ID:-}" || -z "${ASC_ISSUER_ID:-}" ]]; then
        ios_die "ASC_KEY_PATH, ASC_KEY_ID, and ASC_ISSUER_ID must be set together."
    fi

    APP_STORE_AUTH_ARGS=(
        -authenticationKeyPath "$ASC_KEY_PATH"
        -authenticationKeyID "$ASC_KEY_ID"
        -authenticationKeyIssuerID "$ASC_ISSUER_ID"
    )
}

ios_set_provisioning_args() {
    IOS_PROVISIONING_ARGS=()

    if [[ "${IOS_ALLOW_PROVISIONING_UPDATES:-1}" != "0" ]]; then
        IOS_PROVISIONING_ARGS=(-allowProvisioningUpdates)
    fi
}

ios_detect_device_id() {
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

ios_write_export_options_plist() {
    local output_path="$1"
    local team_id_block=""
    local team_id="${IOS_EXPORT_TEAM_ID_VALUE:-${APPLE_TEAM_ID:-}}"

    if [[ -n "$team_id" ]]; then
        team_id_block="
    <key>teamID</key>
    <string>${team_id}</string>"
    fi

    cat >"$output_path" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>${IOS_EXPORT_METHOD_VALUE}</string>
    <key>destination</key>
    <string>${IOS_EXPORT_DESTINATION_VALUE}</string>
    <key>signingStyle</key>
    <string>${IOS_SIGNING_STYLE_VALUE}</string>${team_id_block}
    <key>stripSwiftSymbols</key>
    <${IOS_STRIP_SWIFT_SYMBOLS_VALUE}/>
    <key>uploadSymbols</key>
    <${IOS_UPLOAD_SYMBOLS_VALUE}/>
</dict>
</plist>
PLIST
}
