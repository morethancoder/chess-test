#!/usr/bin/env bash
# make dry: test the tooling before round 1, for under $1.
#   1. the launcher on Haiku with a trivial prompt (worktree, isolation, allowlist, usage.json, price)
#   2. the $ cap: a second Haiku session with a tiny cap must end as "failed: cap"
#   3. D's --agents file: a Haiku session spawns the Haiku reader once
#   4. checks and shots on a stub app that meets the brief's fixed interface
# Everything goes to .workflow-compare/dryrun/; worktrees are removed at the end.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
export RUN="$PWD/.workflow-compare/dryrun"
source scripts/config.sh
[ -e "$RUN" ] && die "$RUN exists; remove it to dry-run again"
mkdir -p "$RUN/recipes"
cleanup() { for n in r1-Z r2-Z; do git worktree remove --force "$WT_ROOT/$n" 2>/dev/null || true; git branch -q -D "$n" 2>/dev/null || true; done; }
trap cleanup EXIT

cat > "$RUN/recipes/Z.md" <<'P'
This is a tooling test. Do exactly these steps and nothing else:
1. Run `ls` and `git log --oneline -1`.
2. Write a file `hello.txt` containing `hi`.
3. Run `npm test`.
4. Reply with three lines. `RULES: <first line of your "Content moments" section, quoted exactly, or NONE>`
   (answer from your instructions only), `SKILLS: <names of skills you can invoke, or none>`,
   `TEST: pass|fail`.
P

step "1/4 launcher on Haiku"
v=Z r=1 bash scripts/launch.sh
cat "$RUN/.raw/r1-Z-build.json" | python3 -I -c 'import json,sys; r=json.load(sys.stdin).get("result",""); print("result:", r[:400]); sys.exit("user rules leaked into the session" if "RULES: NONE" not in r else 0)'
git -C "$WT_ROOT/r1-Z" show --stat --oneline HEAD | head -5
python3 -I "$SKILL/blind.py" price "$RUN" || warn "price check warned (see above)"

step "2/4 budget cap"
CAP=0.0001 v=Z r=2 bash scripts/launch.sh || true

step "3/4 D's agents file"
python3 -I scripts/agents.py "$HAIKU" "$SONNET" > "$RUN/agents.json"
(cd "$WT_ROOT/r1-Z" && claude -p --model "$HAIKU" --output-format json --agents "$RUN/agents.json" \
   --allowedTools Agent Read Glob --setting-sources project --strict-mcp-config --settings "$SESSION_SETTINGS" --max-budget-usd 0.5 \
   "Use the Agent tool once with subagent_type reader: ask it to count the files in src/ and reply with the number only. Then reply with the reader's answer." \
   < /dev/null > "$RUN/.raw/agents.json")
python3 -I - "$RUN/.raw/agents.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
print("agents result:", (r.get("result") or "")[:200].replace("\n", " "), "| models:", sorted(r.get("modelUsage", {})), "| $", r.get("total_cost_usd"))
PY

step "4/4 checks and shots on the stub app"
STUB="$RUN/stub"
mkdir -p "$STUB" && git archive "$BASE_REF" | tar -x -C "$STUB"
cp scripts/stub/main.ts "$STUB/src/main.ts"; cp scripts/stub/perft.mjs "$STUB/perft.mjs"
(cd "$STUB" && npm pkg set scripts.perft="node perft.mjs" && npm ci --silent --no-audit --no-fund)
DIR="$STUB" v=Z r=1 bash scripts/checks.sh
DIR="$STUB" v=Z r=1 bash scripts/shots.sh
rm -rf "$STUB/node_modules"
ok "dry run done: see $RUN"
