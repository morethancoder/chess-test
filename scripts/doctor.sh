#!/usr/bin/env bash
# Checks every CLI the lead's scripts call. Missing tools fail the run.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
fail=0
step "tools"
check_cli git     "https://git-scm.com/downloads" || fail=1
check_cli node    "https://nodejs.org" || fail=1
check_cli npm     "comes with node" || fail=1
check_cli claude  "https://docs.claude.com/claude-code" || fail=1
check_cli python3 "https://www.python.org" || fail=1
check_cli perl    "part of macOS" || fail=1
check_cli uuidgen "part of macOS" || fail=1
check_cli lsof    "part of macOS" || fail=1
step "project"
if [ -d node_modules ]; then ok "node_modules installed"; else warn "node_modules missing: run make setup"; fail=1; fi
if .venv/bin/python -I -c "import chess" 2>/dev/null; then ok "python-chess in .venv"; else warn "python-chess missing: run make setup"; fail=1; fi
if [ -f "$HOME/.claude/skills/workflow-compare/scripts/blind.py" ]; then ok "workflow-compare blind.py"; else err "workflow-compare skill missing"; fail=1; fi
step "result"
if [ "$fail" -eq 0 ]; then ok "all required tooling present"; else die "missing tooling above"; fi
