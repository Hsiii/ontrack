#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

IOS_MOCK_DATA=1 "$ROOT_DIR/tools/ios/run-device.sh"
