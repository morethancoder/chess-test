#!/usr/bin/env bash
# make rank: your blind rating of the ten builds (plan Step 3; scores 1-10 or 1-5, cards shuffled).
# Packs <run>/rank/ with its own shuffle (Build 1..10, mapping in <run>/.mapping-user.json, which
# the page never loads), a playable copy and the 20 shots per build, then serves it locally.
# Rating every build and pressing Save writes <run>/user-rank.json. Ctrl-C stops it.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
source scripts/config.sh

PORT_RANK="${PORT_RANK:-5300}"
REP="$RUN/report"; DEST="$RUN/rank"
[ -d "$REP/builds" ] || die "no playable copies yet: run make report first"
require_free_port "$PORT_RANK" "rank page"

if [ ! -f "$RUN/.mapping-user.json" ] || [ "${fresh:-}" = "1" ]; then
  step "rank: packing a fresh shuffle"
  rm -rf "$DEST"; mkdir -p "$DEST"
  python3 -I - "$RUN" <<'EOF'
import json, os, random, shutil, sys
run = sys.argv[1]; rep = os.path.join(run, "report"); dest = os.path.join(run, "rank")
names = sorted(d for d in os.listdir(os.path.join(rep, "builds")))
nums = list(range(1, len(names) + 1)); random.SystemRandom().shuffle(nums)
mapping = {}
for name, n in zip(names, nums):
    shutil.copytree(os.path.join(rep, "builds", name), os.path.join(dest, str(n), "app"))
    shutil.copytree(os.path.join(rep, "shots", name), os.path.join(dest, str(n), "shots"))
    mapping[str(n)] = name
json.dump(mapping, open(os.path.join(run, ".mapping-user.json"), "w"), indent=2)
json.dump(sorted(nums), open(os.path.join(dest, "labels.json"), "w"))
print(f"packed {len(names)} builds as Build 1..{len(names)}")
EOF
fi
cp "$REP/puzzles.json" "$DEST/puzzles.json"  # one build fetches /puzzles.json from the root
cp scripts/rank.html "$DEST/index.html"
ok "rank page: http://127.0.0.1:$PORT_RANK/  (Ctrl-C to stop)"
exec python3 -I scripts/rank_server.py "$DEST" "$PORT_RANK" "$RUN/user-rank.json"
