#!/usr/bin/env bash
# First-time setup: npm packages, Playwright's Chromium, python-chess in .venv, then doctor.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
step "npm"; npm ci --silent --no-audit --no-fund && ok "node_modules"
step "chromium"; npx playwright install chromium >/dev/null && ok "Playwright Chromium"
step "python-chess"; [ -d .venv ] || python3 -m venv .venv; .venv/bin/pip install -q chess && ok ".venv with python-chess"
bash scripts/doctor.sh
