#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IOS_MOCK_DATA=1 "$SCRIPT_DIR/ios-run-device.sh"
