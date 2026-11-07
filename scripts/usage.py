"""Turn the raw `claude -p` JSON results of one build into its usage.json (blind.py's format).

  usage.py status <raw.json>                     print ok | failed: cap | failed: <subtype>
  usage.py write <raw dir> <name> <out> <model>  write usage.json from <raw>/<name>-{build,check}.json
  usage.py show <usage.json>                     print a one-screen summary
"""
import json
import os
import sys

FAM = ("opus", "sonnet", "haiku")


def fam(model):
    return next((f for f in FAM if f in (model or "")), model)


def load(path):
    try:
        return json.load(open(path))
    except (OSError, ValueError):
        return None


def status(res):
    if res is None:
        return "failed: no result"
    sub = str(res.get("subtype", ""))
    if "budget" in sub:
        return "failed: cap"
    if res.get("is_error") or sub not in ("success", ""):
        return f"failed: {sub or 'error'}"
    return "ok"


def write(raw, name, out, main_model):
    parts, total_ms, models, denied = [], 0, set(), {}
    state = "ok"
    for tag in ("build", "check"):
        meta = load(os.path.join(raw, f"{name}-{tag}.meta.json"))
        if not meta:
            continue
        res = load(os.path.join(raw, f"{name}-{tag}.json"))
        st = status(res)
        if st != "ok" and state == "ok":
            state = st if tag == "build" else f"check {st}"
        res = res or {}
        used = sorted((res.get("modelUsage") or {}).keys())
        models.update(used)
        denied[tag] = [d.get("tool_name") for d in res.get("permission_denials") or []]
        total_ms += meta["ms"]
        parts.append({"model": fam(meta["model"]), "ms": meta["ms"], "step": tag, "session": meta["session"],
                      "total_cost_usd": res.get("total_cost_usd"), "status": st, "turns": res.get("num_turns"),
                      "models_used": used, "denied": denied[tag], "exit": meta["rc"]})
    usage = {"ms": total_ms, "status": state, "pinned_model": main_model, "models_used": sorted(models),
             "parts": parts}
    json.dump(usage, open(out, "w"), indent=2)


def show(path):
    u = json.load(open(path))
    print(f"status {u['status']}, {u['ms'] / 60000:.1f} min, models {', '.join(u['models_used']) or '?'}")
    for p in u["parts"]:
        usd = p["total_cost_usd"]
        print(f"  {p['step']:5} {p['model']:6} {p['status']:12} {p['ms'] / 60000:5.1f} min "
              f"turns {p['turns']} reported ${usd if usd is not None else '?'} denied {len(p['denied'])} {p['denied'][:5]}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "status":
        print(status(load(sys.argv[2])))
    elif cmd == "write":
        write(*sys.argv[2:6])
    elif cmd == "show":
        show(sys.argv[2])
    else:
        sys.exit(__doc__)
