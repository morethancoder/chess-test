# Shared settings for the lead's scripts. Sourced after _lib.sh.
RUN="${RUN:-$PWD/.workflow-compare/2026-11-07-chess-trainer}"
WT_ROOT="$HOME/Demos/chess-test.wt"
BASE_REF="base"
CAP_USD=40
SKILL="$HOME/.claude/skills/workflow-compare/scripts"

OPUS="claude-opus-5-5"
SONNET="claude-sonnet-5-5"
HAIKU="claude-haiku-5-5"

# The build session's model per variant. C and D also get a Sonnet checklist session.
main_model() {
  case "$1" in
    A|D) echo "$OPUS" ;;
    B|C|E) echo "$SONNET" ;;
    Z) echo "$HAIKU" ;;          # dry run only
    *) die "unknown variant '$1' (A B C D E)" ;;
  esac
}
has_check() { [ "$1" = C ] || [ "$1" = D ]; }

# Tools a build may use without prompts. Agent only for D (A, B, C, E stay single-model).
ALLOW_BASE="Read Edit Write Glob Grep TodoWrite Bash(npm:*) Bash(npx:*) Bash(node:*) Bash(git:*) Bash(ls:*) Bash(mkdir:*) Bash(cat:*) Bash(curl:*) Bash(sleep:*) Bash(lsof:*)"
allow_for() { if [ "$1" = D ]; then echo "$ALLOW_BASE Agent"; else echo "$ALLOW_BASE"; fi; }

# Each build gets its own port: r1-A 5111 ... r2-E 5125; checks use +100.
port_for() {
  local i; i=$(printf 'ABCDEZ' | awk -v v="$1" '{print index($0, v)}')
  [ "$i" -gt 0 ] || die "unknown variant '$1'"
  echo $((5100 + $2 * 10 + i))
}

need_vr() {
  [[ "${v:-}" =~ ^[A-EZ]$ ]] || die "set v=A|B|C|D|E (for example: make launch v=A r=1)"
  [[ "${r:-}" =~ ^[12]$ ]]  || die "set r=1|2 (for example: make launch v=A r=1)"
  NAME="r$r-$v"; OUT="$RUN/$NAME"; WT="$WT_ROOT/$NAME"
}

# The folder checks and shots run on: the build's worktree, or DIR=<path> (the dry run's stub app).
target_dir() { echo "${DIR:-$WT}"; }

# with_timeout <seconds> <cmd...> (macOS has no timeout(1))
with_timeout() { local s=$1; shift; perl -e 'alarm shift; exec @ARGV' "$s" "$@"; }

serve_start() {  # serve_start <dir> <port> <log>: start the build's dev server, wait until it answers
  local dir=$1 port=$2 log=$3
  [ -z "$(port_pids "$port")" ] || die "port $port is busy: $(port_pids "$port" | tr '\n' ' ')"
  (cd "$dir" && PORT="$port" nohup npm run dev > "$log" 2>&1 &)
  for _ in $(seq 1 60); do
    curl -s -o /dev/null -m 1 "http://localhost:$port/" && return 0
    sleep 0.5
  done
  return 1
}
serve_stop() { for pid in $(port_pids "$1"); do kill "$pid" 2>/dev/null || true; done; }

# Builds must not see the user's global rules. ~/.claude/CLAUDE.md is also "<home>/.claude/CLAUDE.md",
# an ancestor project file of every worktree under home, so --setting-sources project alone still
# loads it (seen in the 2026-11-07 dry run). Exclude it by path.
SESSION_SETTINGS="{\"claudeMdExcludes\": [\"$HOME/.claude/CLAUDE.md\"]}"
