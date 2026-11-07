#!/usr/bin/env bash
# make checks v= r=: the code checks of one build, written to <run>/r<r>-<v>/checks.md.
# A failed check is a result, not an error: this exits non-zero only when the tooling itself breaks.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/_lib.sh
load_env
source scripts/config.sh
need_vr
D=$(target_dir); [ -f "$D/package.json" ] || die "no build at $D"
P=$(( $(port_for "$v" "$r") + 100 ))
LOGS="$OUT/logs"; mkdir -p "$LOGS"
LEAD=$PWD
md="$OUT/checks.md"; pass=0; fail=0
line() { if [ "$1" = PASS ]; then pass=$((pass+1)); else fail=$((fail+1)); fi; echo "| $1 | $2 | $3 |" >> "$md"; }
{ echo "# Checks: $NAME"; echo; echo "Commit \`$(git -C "$D" rev-parse --short HEAD 2>/dev/null || echo none)\`, $(date '+%Y-%m-%d %H:%M')."; echo
  echo "| Result | Check | Detail |"; echo "|---|---|---|"; } > "$md"

step "$NAME: perft"
START="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
KIWI="r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"
perft() {  # perft <label> <fen> <depth> <want>
  local got
  got=$(cd "$D" && with_timeout 300 npm run --silent perft -- "$2" "$3" 2>>"$LOGS/perft.log" | tail -1 | tr -d '[:space:]') || got="${got:-error}"
  if [ "$got" = "$4" ]; then line PASS "perft $1 depth $3" "$got"; ok "$1 $3 = $got"
  else line FAIL "perft $1 depth $3" "want $4, got \`${got:-nothing}\`"; warn "$1 $3: want $4, got ${got:-nothing}"; fi
}
perft start "$START" 1 20; perft start "$START" 2 400; perft start "$START" 3 8902; perft start "$START" 4 197281
perft kiwipete "$KIWI" 1 48; perft kiwipete "$KIWI" 2 2039; perft kiwipete "$KIWI" 3 97862

step "$NAME: npm test, e2e, build"
for s in test e2e build; do
  if (cd "$D" && PORT=$P with_timeout 600 npm run "$s" > "$LOGS/$s.log" 2>&1); then
    if [ "$s" != build ] && ! grep -Eq '[1-9][0-9]* passed' "$LOGS/$s.log"; then
      line FAIL "npm run $s" "exit 0 but no tests ran"; warn "$s ran no tests"; serve_stop "$P"; continue
    fi
    line PASS "npm run $s" "$(grep -Eo '[0-9]+ (passed|failed)' "$LOGS/$s.log" | tr '\n' ' ' | head -c 80)"; ok "$s"
  else
    line FAIL "npm run $s" "see logs/$s.log: $(grep -Ei 'error|fail' "$LOGS/$s.log" | head -1 | tr '|' '/' | cut -c1-120)"; warn "$s failed"
  fi
  serve_stop "$P"
done

step "$NAME: page at 390 px"
if serve_start "$D" "$P" "$LOGS/dev.log"; then
  node scripts/browser.mjs checks "http://localhost:$P" "$LOGS/page.json" > /dev/null 2>"$LOGS/page.err" || { serve_stop "$P"; die "browser check crashed: $(head -3 "$LOGS/page.err")"; }
  serve_stop "$P"
  python3 -I - "$LOGS/page.json" >> "$md.tmp" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
errs = r["errors"]
print(("PASS" if not errs else "FAIL") + "\tconsole errors\t" + ("none" if not errs else f"{len(errs)}: " + errs[0][:120].replace("|", "/")))
for name, w in r["overflow"].items():
    print(("PASS" if w <= 390 else "FAIL") + f"\tno horizontal scroll at 390 px ({name})\tscrollWidth {w}")
PY
  while IFS=$'\t' read -r res name detail; do line "$res" "$name" "$detail"; done < "$md.tmp"; rm -f "$md.tmp"
else
  serve_stop "$P"; line FAIL "dev server starts on \$PORT" "see logs/dev.log"
fi
{ echo; echo "**$pass passed, $fail failed.**"; } >> "$md"
ok "$pass passed, $fail failed → $md"
