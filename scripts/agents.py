"""Print D's --agents JSON: the user's reader and editor agents with pinned model ids.

  agents.py <haiku id> <sonnet id>
"""
import json
import os
import sys

SRC = os.path.expanduser("~/.claude/agents")


def load(name, model):
    text = open(os.path.join(SRC, f"{name}.md")).read()
    _, front, body = text.split("---", 2)
    meta = {}
    for line in front.strip().splitlines():
        k, _, val = line.partition(":")
        meta[k.strip()] = val.strip()
    return {"description": meta["description"], "prompt": body.strip(), "model": model,
            "tools": [t.strip() for t in meta.get("tools", "").split(",") if t.strip()]}


print(json.dumps({"reader": load("reader", sys.argv[1]), "editor": load("editor", sys.argv[2])}, indent=2))
