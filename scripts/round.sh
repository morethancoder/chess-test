#!/usr/bin/env bash
# make round v= r=: launch, then checks, then shots for one build. Stops at the first stage that breaks.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
source scripts/config.sh
need_vr
for stage in launch checks shots; do
  bash "scripts/$stage.sh" || die "$NAME: stage '$stage' failed; fix it before the next build"
done
st=$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "$OUT/usage.json")
ok "$NAME done: build $st, $(tail -1 "$OUT/checks.md" | tr -d '*'), shots $(python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d["shots"]), "of 20")' "$OUT/shots.json")"
