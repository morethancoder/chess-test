"""Code check between grading stages (plan Step 3).

  python3 -I scripts/grade_check.py <run>

1. Validates every blind-<n>/grades.json present: all labels, the four scores as integers 1-10,
   notes, missed checklist lines (1-24), a winner that is a label.
2. Maps each pass back to build names (.mapping-<n>.json) and compares the passes.
3. Prints NEED-THIRD if any build differs by more than 1 on any line between passes 1 and 2
   (and pass 3 is missing). Otherwise writes the final result: per line the median of the
   passes (the mean of two when only two ran), into blind/grades.json with an identity-style
   .mapping.json, so `blind.py record` reads it. Exit 1 on a bad file.
"""
import json
import os
import statistics
import sys

run = sys.argv[1]
LINES = ("correctness", "completeness", "code_quality", "visual")
passes = {}
for n in (1, 2, 3):
    gp = os.path.join(run, f"blind-{n}", "grades.json")
    if not os.path.exists(gp):
        continue
    mapping = json.load(open(os.path.join(run, f".mapping-{n}.json")))
    g = json.load(open(gp))
    bad = []
    for label in mapping:
        e = g.get(label)
        if not isinstance(e, dict):
            bad.append(f"{label}: missing")
            continue
        bad += [f"{label}.{k}: {e.get(k)!r}" for k in LINES
                if not (isinstance(e.get(k), int) and 1 <= e[k] <= 10)]
        if not str(e.get("notes", "")).strip():
            bad.append(f"{label}.notes empty")
        if not all(isinstance(x, int) and 1 <= x <= 24 for x in e.get("missed", [])):
            bad.append(f"{label}.missed: {e.get('missed')!r}")
    if g.get("winner") not in mapping:
        bad.append(f"winner: {g.get('winner')!r}")
    if bad:
        print(f"pass {n} grades.json is invalid:\n  " + "\n  ".join(bad))
        sys.exit(1)
    passes[n] = {mapping[lab]: g[lab] for lab in mapping} | {"_winner": mapping[g["winner"]]}
    print(f"pass {n}: valid, winner {passes[n]['_winner']}")

if not {1, 2} <= passes.keys():
    print("waiting for passes 1 and 2")
    sys.exit(0)

builds = sorted(k for k in passes[1] if not k.startswith("_"))
far = [(b, k, passes[1][b][k], passes[2][b][k]) for b in builds for k in LINES
       if abs(passes[1][b][k] - passes[2][b][k]) > 1]
print(f"\n{'build':6}" + "".join(f"{k[:12]:>14}" for k in LINES) + f"{'total':>8}")
final = {}
for b in builds:
    vals = {k: [passes[n][b][k] for n in sorted(passes)] for k in LINES}
    med = {k: statistics.median(v) for k, v in vals.items()}
    final[b] = med
    cells = "".join(f"{'/'.join(map(str, vals[k])) + ' → ' + f'{med[k]:g}':>14}" for k in LINES)
    print(f"{b:6}{cells}{sum(med.values()):>8g}")
print("winners by pass: " + ", ".join(f"{n}: {passes[n]['_winner']}" for n in sorted(passes)))
if far and 3 not in passes:
    print("\nNEED-THIRD: lines more than 1 apart between passes 1 and 2:")
    for b, k, a, c in far:
        print(f"  {b} {k}: {a} vs {c}")
    sys.exit(0)

# Final file for blind.py record: labels are the build names themselves (grading is over).
best = max(builds, key=lambda b: sum(final[b].values()))
out = {b: {**final[b],
           "notes": " | ".join(f"pass {n}: {passes[n][b]['notes']}" for n in sorted(passes)),
           "missed": sorted({x for n in passes for x in passes[n][b].get("missed", [])})}
       for b in builds}
out["winner"] = best
os.makedirs(os.path.join(run, "blind"), exist_ok=True)
json.dump(out, open(os.path.join(run, "blind", "grades.json"), "w"), indent=2)
json.dump({b: b for b in builds}, open(os.path.join(run, ".mapping.json"), "w"), indent=2)
print(f"\nFINAL: {len(passes)} passes combined, top total {best}; wrote blind/grades.json and .mapping.json")
