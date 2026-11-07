#!/usr/bin/env bash
# make launch v=<A..E> r=<1|2>: one build in its own worktree, as headless session(s).
# Writes <run>/r<r>-<v>/usage.json and the raw JSON results to <run>/.raw/.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
source scripts/config.sh
need_vr
require_cli claude "https://docs.claude.com/claude-code"
require_cli uuidgen "part of macOS"

MODEL=$(main_model "$v")
PORT=$(port_for "$v" "$r")
RAW="$RUN/.raw"; mkdir -p "$RAW"
RECIPES="${RECIPES:-$RUN/recipes}"
CLI=$(claude --version | awk '{print $1}')

step "$NAME: preflight"
[ -e "$OUT/usage.json" ] && die "$NAME already ran ($OUT/usage.json). Builds are not re-run in a round."
recipe="$RECIPES/$v.md"; [ -f "$recipe" ] || die "no recipe at $recipe"
grep -q '^DRAFT' "$recipe" && die "$recipe is still a draft (remove the DRAFT line once approved)"
if has_check "$v"; then
  check="$RECIPES/check.md"; [ -f "$check" ] || die "no checklist recipe at $check"
  grep -q '^DRAFT' "$check" && die "$check is still a draft"
fi
# Pinned CLI version and model ids: the first real build writes pins.json, later ones must match.
if [ "$v" != Z ]; then
  pins="$RUN/pins.json"; want="{\"cli\": \"$CLI\", \"opus\": \"$OPUS\", \"sonnet\": \"$SONNET\", \"haiku\": \"$HAIKU\"}"
  if [ -f "$pins" ]; then
    python3 -I -c 'import json,sys; a=json.load(open(sys.argv[1])); b=json.loads(sys.argv[2]); sys.exit(a!=b)' "$pins" "$want" \
      || die "pins changed since the first build: $(cat "$pins") now $want"
  else
    echo "$want" > "$pins"; ok "pinned $want"
  fi
fi
[ -n "$(port_pids "$PORT")" ] && die "port $PORT is busy: $(port_pids "$PORT" | tr '\n' ' ')"
ok "model $MODEL, port $PORT, CLI $CLI"

step "$NAME: worktree"
git rev-parse -q --verify "$BASE_REF" >/dev/null || die "no '$BASE_REF' tag"
[ -e "$WT" ] && die "$WT already exists"
mkdir -p "$WT_ROOT" "$OUT"
git worktree add -q -b "$NAME" "$WT" "$BASE_REF"
(cd "$WT" && npm ci --silent --no-audit --no-fund)
ok "$WT on branch $NAME from $(git rev-parse --short "$BASE_REF")"

# D's subagents, frozen from ~/.claude/agents with pinned models.
AGENTS_ARGS=()
if [ "$v" = D ]; then
  python3 -I scripts/agents.py "$HAIKU" "$SONNET" > "$RUN/agents.json"
  AGENTS_ARGS=(--agents "$RUN/agents.json")
fi

session() {  # session <tag> <model> <prompt file> [extra args...]
  local tag=$1 model=$2 prompt=$3; shift 3
  local sid t0 t1 rc
  sid=$(uuidgen | tr 'A-Z' 'a-z')
  step "$NAME: session $tag ($model, $sid)"
  t0=$(python3 -c 'import time; print(int(time.time()*1000))')
  set +e
  # --setting-sources project: no user CLAUDE.md, hooks or permissions, so builds follow only the
  # recipe and brief. --strict-mcp-config: no MCP servers. No --fallback-model.
  (cd "$WT" && PORT="$PORT" claude -p --model "$model" --output-format json --session-id "$sid" \
     --permission-mode acceptEdits --allowedTools $(allow_for "$v") \
     $( [ "$v" = D ] || echo "--disallowedTools Agent" ) \
     --max-budget-usd "${CAP:-$CAP_USD}" --setting-sources project --strict-mcp-config --settings "$SESSION_SETTINGS" \
     "$@" < "$prompt" > "$RAW/$NAME-$tag.json" 2> "$RAW/$NAME-$tag.err")
  rc=$?
  set -e
  t1=$(python3 -c 'import time; print(int(time.time()*1000))')
  echo "{\"tag\": \"$tag\", \"model\": \"$model\", \"session\": \"$sid\", \"rc\": $rc, \"ms\": $((t1 - t0))}" > "$RAW/$NAME-$tag.meta.json"
  ok "session $tag ended (exit $rc, $(( (t1 - t0) / 1000 )) s)"
  for pid in $(port_pids "$PORT"); do warn "stopping leftover server $pid on $PORT"; kill "$pid" || true; done
  # Keep everything the session left, committed or not, on the build's branch.
  (cd "$WT" && git add -A && { git diff --cached --quiet || git commit -q -m "lead: work left uncommitted at the end of session $tag"; })
}

session build "$MODEL" "$recipe" "${AGENTS_ARGS[@]+"${AGENTS_ARGS[@]}"}"
status=$(python3 -I scripts/usage.py status "$RAW/$NAME-build.json")
if has_check "$v" && [ "$status" = ok ]; then
  session check "$SONNET" "$check"
fi

step "$NAME: record"
python3 -I scripts/usage.py write "$RAW" "$NAME" "$OUT/usage.json" "$MODEL"
git -C "$WT" diff "$BASE_REF"..HEAD > "$OUT/diff.patch"
ok "$(git -C "$WT" diff --shortstat "$BASE_REF"..HEAD)"
python3 -I scripts/usage.py show "$OUT/usage.json"
