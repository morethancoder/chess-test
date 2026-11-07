"""Collect every recorded build of the run into <run>/report/data.json for the report page.

  python3 -I scripts/report.py <run dir>

Reads r<r>-<v>/{usage.json, checks.md, shots.json, diff.patch}. Prices are the CLI's own
total_cost_usd, which pricing.py cross-checks against the billed transcripts (make price).
"""
import json
import os
import re
import sys

run = sys.argv[1]
out = os.path.join(run, "report")
builds = []
for name in sorted(os.listdir(run)):
    d = os.path.join(run, name)
    if not re.fullmatch(r"r[12]-[A-E]", name) or not os.path.exists(os.path.join(d, "usage.json")):
        continue
    u = json.load(open(os.path.join(d, "usage.json")))
    parts = [{"step": p["step"], "model": p["model"], "min": round(p["ms"] / 60000, 1), "turns": p["turns"],
              "usd": round(p["total_cost_usd"] or 0, 2), "denied": len(p["denied"])} for p in u["parts"]]
    checks = []
    if os.path.exists(os.path.join(d, "checks.md")):
        for line in open(os.path.join(d, "checks.md")):
            m = re.match(r"\| (PASS|FAIL) \| (.+?) \| (.*?) \|", line)
            if m:
                checks.append({"ok": m[1] == "PASS", "name": m[2], "detail": m[3].strip()})
    shots_ok = 0
    if os.path.exists(os.path.join(d, "shots.json")):
        shots_ok = len(json.load(open(os.path.join(d, "shots.json"))).get("shots", []))
    files = plus = minus = 0
    if os.path.exists(os.path.join(d, "diff.patch")):
        for line in open(os.path.join(d, "diff.patch"), errors="replace"):
            if line.startswith("diff --git"):
                files += 1
            elif line.startswith("+") and not line.startswith("+++"):
                plus += 1
            elif line.startswith("-") and not line.startswith("---"):
                minus += 1
    has_build = os.path.exists(os.path.join(out, "builds", name, "index.html"))
    builds.append({"name": name, "round": int(name[1]), "variant": name[3], "status": u["status"],
                   "models": u["models_used"], "min": round(u["ms"] / 60000, 1),
                   "usd": round(sum(p["usd"] for p in parts), 2), "parts": parts, "checks": checks,
                   "shots": shots_ok, "files": files, "plus": plus, "minus": minus, "playable": has_build})

os.makedirs(out, exist_ok=True)
json.dump({"builds": builds}, open(os.path.join(out, "data.json"), "w"), indent=1)
print(f"{len(builds)} builds → {out}/data.json")
