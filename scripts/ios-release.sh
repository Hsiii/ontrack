#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/ios-common.sh"

IOS_RELEASE_PROMPT="${IOS_RELEASE_PROMPT:-1}"
ios_resolve_release_versions

"$SCRIPT_DIR/ios-archive.sh"
"$SCRIPT_DIR/ios-upload.sh"
