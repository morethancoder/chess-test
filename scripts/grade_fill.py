"""Fill one blind pass: add shots and sheets per label, drop identifying files, then check it.

  python3 -I scripts/grade_fill.py <run> <pass> <shots dir>

Fails (exit 1) if a label is missing a file the grader needs, or if anything left in the pass
names a build (r1-A ... r2-E), a model, or a build port (5111-5125, 5211-5225).
"""
import json
import os
import re
import shutil
import sys

run, n, shots = sys.argv[1], sys.argv[2], sys.argv[3]
blind = os.path.join(run, f"blind-{n}")
mapping = json.load(open(os.path.join(run, f".mapping-{n}.json")))
for f in ("brief.md", "checklist.md"):
    shutil.copy(os.path.join(run, f), os.path.join(blind, f))
problems = []
for label, build in sorted(mapping.items()):
    d = os.path.join(blind, label)
    shutil.rmtree(os.path.join(d, "logs"), ignore_errors=True)
    for f in ("shots.json",):
        if os.path.exists(os.path.join(d, f)):
            os.remove(os.path.join(d, f))
    # Redact in the blind copy only: the checks header names the build and its commit time
    # (which gives away run order); build notes sometimes quote the build's own port.
    ck = os.path.join(d, "checks.md")
    lines = open(ck).read().splitlines()
    lines = ["# Checks"] + [ln for ln in lines[1:] if not ln.startswith("Commit `")]
    open(ck, "w").write("\n".join(lines) + "\n")
    port = re.compile(r"\b5[12](1[1-9]|2[0-5])\b")
    for f in ("diff.patch", "checks.md"):
        p = os.path.join(d, f)
        text = open(p, errors="replace").read()
        open(p, "w").write(port.sub("<port>", text))
    os.makedirs(os.path.join(d, "shots"), exist_ok=True)
    for f in os.listdir(os.path.join(shots, build)):
        if f.endswith(".png") and "FAILED" not in f:
            shutil.copy(os.path.join(shots, build, f), os.path.join(d, "shots", f))
    for k in ("phone", "desktop-light", "desktop-dark"):
        shutil.copy(os.path.join(shots, "sheets", f"{build}-{k}.png"), os.path.join(d, f"sheet-{k}.png"))
    need = ["diff.patch", "checks.md", "sheet-phone.png", "sheet-desktop-light.png", "sheet-desktop-dark.png"]
    problems += [f"{label}: missing or empty {f}" for f in need
                 if not os.path.exists(os.path.join(d, f)) or os.path.getsize(os.path.join(d, f)) < 500]
    n_shots = len([f for f in os.listdir(os.path.join(d, "shots")) if f.endswith(".png")])
    if n_shots != 20:
        problems.append(f"{label}: {n_shots} shots, want 20")

leak = re.compile(r"\br[12]-[A-E]\b|\b(opus|sonnet|haiku)\b|\b5[12](1[1-9]|2[0-5])\b", re.I)
for root, _, files in os.walk(blind):
    for f in files:
        p = os.path.join(root, f)
        if leak.search(os.path.relpath(p, blind)):
            problems.append(f"name leaks: {os.path.relpath(p, blind)}")
        if f.endswith((".md", ".patch", ".json", ".txt")):
            for i, line in enumerate(open(p, errors="replace"), 1):
                m = leak.search(line)
                if m:
                    problems.append(f"{os.path.relpath(p, blind)}:{i}: '{m.group(0)}'")
if problems:
    print("\n".join(problems[:40]))
    sys.exit(1)
print(f"pass {n}: {len(mapping)} labels {', '.join(sorted(mapping))}, each with diff, checks, 20 shots, 3 sheets; no leaks")
