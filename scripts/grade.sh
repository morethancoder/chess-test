#!/usr/bin/env bash
# make grade: prepare the two blind grading passes (plan Step 3).
# Each pass is its own blind.py pack (fresh random labels) in <run>/blind-<n>/, mapping kept in
# <run>/.mapping-<n>.json (lead only). Each label gets diff.patch, checks.md, the 20 shots and
# three contact sheets. logs/ and shots.json are dropped: they hold ports, which name the build.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
source scripts/config.sh

BLIND="$HOME/.claude/skills/workflow-compare/scripts/blind.py"
SHOTS="$PWD/.playwright/2026-11-07-chess-trainer"
step "grade: contact sheets"
node scripts/sheets.mjs "$SHOTS"

# make grade pass=3 packs one more pass (the tie-break) and leaves the others alone.
if [ -n "${pass:-}" ]; then PASSES="$pass"; else
  PASSES="1 2"; rm -rf "$RUN"/blind "$RUN"/blind-[0-9] "$RUN"/.mapping-[0-9].json "$RUN"/.mapping.json
fi
for pass in $PASSES; do
  step "grade: blind pack, pass $pass"
  python3 -I "$BLIND" pack "$RUN"
  rm -rf "$RUN/blind-$pass"; mv "$RUN/blind" "$RUN/blind-$pass"; mv "$RUN/.mapping.json" "$RUN/.mapping-$pass.json"
  python3 -I scripts/grade_fill.py "$RUN" "$pass" "$SHOTS"
  cp "$RUN/grader-brief.md" "$RUN/blind-$pass/"
done
