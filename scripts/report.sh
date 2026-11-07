#!/usr/bin/env bash
# make report: gather every recorded build into <run>/report/ for the report artifact:
# a playable copy of each build (vite, relative base), its 20 shots, and data.json.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
source scripts/config.sh

REP="$RUN/report"; mkdir -p "$REP/builds" "$REP/shots"
SHOTS="$PWD/.playwright/2026-11-07-chess-trainer"
step "report: playable copies and shots"
for d in "$RUN"/r${r:-[12]}-[A-E]; do  # r=1 limits it to one round
  name=$(basename "$d"); [ -f "$d/usage.json" ] || continue
  wt="$WT_ROOT/$name"
  if [ -d "$wt" ]; then
    # Build into the report folder; the worktree's own dist/ and source are left alone.
    (cd "$wt" && npx vite build --base ./ --outDir "$REP/builds/$name" --emptyOutDir --logLevel error) \
      && ok "$name build copy" || warn "$name: vite build failed, no playable copy"
  fi
  if [ -d "$SHOTS/$name" ]; then
    mkdir -p "$REP/shots/$name"; cp "$SHOTS/$name"/*.png "$REP/shots/$name/" 2>/dev/null || true
    rm -f "$REP/shots/$name"/*.FAILED.png
  fi
done
cp "$(ls "$WT_ROOT"/r1-A/public/puzzles.json)" "$REP/puzzles.json"  # C fetches /puzzles.json from the root
python3 -I scripts/report.py "$RUN"
