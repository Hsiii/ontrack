#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${ONTRACK_WORKER_PROD_CONFIG:-$ROOT_DIR/apps/worker/wrangler.production.jsonc}"

if [[ ! -f "$CONFIG_PATH" ]]; then
    cat >&2 <<MESSAGE
Missing production Worker config:
  $CONFIG_PATH

Copy apps/worker/wrangler.production.example.jsonc to
apps/worker/wrangler.production.jsonc, then fill in your production route and
D1 database_id. The production config is intentionally ignored by git.
MESSAGE
    exit 1
fi

cd "$ROOT_DIR"
bun run build
wrangler deploy --config "$CONFIG_PATH"
