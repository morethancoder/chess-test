#!/usr/bin/env bash
# make shots v= r=: the 20 fixed shots of one build (5 states x 390/1280 px x light/dark).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
source scripts/config.sh
need_vr
D=$(target_dir); [ -f "$D/package.json" ] || die "no build at $D"
P=$(( $(port_for "$v" "$r") + 100 ))
SHOTS="$PWD/.playwright/$(basename "$RUN")/$NAME"; mkdir -p "$SHOTS" "$OUT/logs"
step "$NAME: shots"
serve_start "$D" "$P" "$OUT/logs/shots-dev.log" || { serve_stop "$P"; die "dev server did not start, see $OUT/logs/shots-dev.log"; }
res=$(node scripts/browser.mjs shots "http://localhost:$P" "$SHOTS" 2>"$OUT/logs/shots.err") || { serve_stop "$P"; die "shot script crashed: $(head -3 "$OUT/logs/shots.err")"; }
serve_stop "$P"
cp "$SHOTS/shots.json" "$OUT/shots.json"
ok "$res"
ok "shots in $SHOTS"
