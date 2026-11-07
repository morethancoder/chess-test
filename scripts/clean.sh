#!/usr/bin/env bash
# Removes build output and test results. Never touches worktrees, run folders or shots.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
rm -rf dist .playwright/test-results test-results playwright-report && ok "removed dist and test results"
