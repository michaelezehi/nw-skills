#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/.venv"
python3 -m venv "$VENV"
"$VENV/bin/pip" install -U pip
"$VENV/bin/pip" install -r "$ROOT/requirements.txt"
"$VENV/bin/playwright" install chromium
echo "OK: $VENV"
echo "Fetch: $VENV/bin/python $ROOT/scripts/fetch.py --url URL --out DIR"
