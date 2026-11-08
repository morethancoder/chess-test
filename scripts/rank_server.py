"""Serve the blind rank page and save the ranking.

  python3 -I scripts/rank_server.py <rank dir> <port> <out json>

GET serves files from <rank dir> on 127.0.0.1. POST /save takes {"scores": {number: 1..scale}, "scale": 5|10,
"shown": [card order on the page], "notes": {number: text}} and writes it to <out json> with a
derived best-first "order" (ties keep the shown order), after checking every build is rated once.
"""
import functools
import http.server
import json
import os
import sys
import time

root, port, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
labels = json.load(open(os.path.join(root, "labels.json")))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/save":
            return self.send_error(404)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            scale = int(body["scale"])
            if scale not in (5, 10):
                raise ValueError("scale must be 5 or 10")
            scores = {int(k): v for k, v in body["scores"].items()}
            if sorted(scores) != sorted(labels):
                raise ValueError(f"rate each of {labels} once")
            if not all(isinstance(v, int) and 1 <= v <= scale for v in scores.values()):
                raise ValueError(f"ratings must be whole numbers 1-{scale}")
            shown = [int(x) for x in body.get("shown", [])]
            notes = {str(k): str(v)[:2000] for k, v in body.get("notes", {}).items() if str(v).strip()}
            # order: best first; ties keep the order the cards were shown in
            order = sorted(labels, key=lambda n: (-scores[n], shown.index(n) if n in shown else 99))
            data = {"scale": scale, "scores": {str(n): scores[n] for n in sorted(scores)}, "order": order,
                    "shown": shown, "notes": notes, "saved": time.strftime("%Y-%m-%d %H:%M")}
            json.dump(data, open(out, "w"), indent=2)
            reply, code = {"ok": True, "saved": data["saved"]}, 200
        except Exception as e:  # noqa: BLE001 - report any bad body back to the page
            reply, code = {"ok": False, "error": str(e)}, 400
        raw = json.dumps(reply).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=root)).serve_forever()
