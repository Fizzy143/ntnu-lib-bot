#!/usr/bin/env bash
set -euo pipefail

node scripts/validate-discord-env.mjs

exec "$@"
