"""Generate and verify original mate-in-1 / mate-in-2 puzzles with python-chess.

  puzzles.py gen <out.json> [seed]   generate 6 mate-in-1 and 6 mate-in-2 puzzles
  puzzles.py verify <file.json>      re-verify every puzzle from scratch; exit 1 on any failure

Rules every puzzle meets:
  mate-in-1: exactly one mating move.
  mate-in-2: no mate in 1; exactly one first move (key) after which every reply allows mate;
             the stored defence leaves exactly one mating move (the stored one).
"""
import json
import random
import sys

import chess


def mates_in_1(b):
    out = []
    for m in b.legal_moves:
        b.push(m)
        if b.is_checkmate():
            out.append(m)
        b.pop()
    return out


def forces_mate_after(b, key):
    """True if after `key` every reply allows a mate in 1 (and there is at least one reply)."""
    b.push(key)
    try:
        if b.is_game_over():
            return False
        for r in b.legal_moves:
            b.push(r)
            ok = bool(mates_in_1(b))
            b.pop()
            if not ok:
                return False
        return True
    finally:
        b.pop()


def keys_m2(b):
    return [m for m in b.legal_moves if forces_mate_after(b, m)]


def check_m1(fen, sol):
    b = chess.Board(fen)
    if not b.is_valid():
        return "invalid position"
    ms = mates_in_1(b)
    if len(ms) != 1:
        return f"{len(ms)} mating moves"
    if [ms[0].uci()] != sol:
        return f"solution {sol} is not the mate {ms[0].uci()}"
    return None


def check_m2(fen, sol):
    b = chess.Board(fen)
    if not b.is_valid():
        return "invalid position"
    if mates_in_1(b):
        return "has a mate in 1"
    ks = keys_m2(b)
    if len(ks) != 1:
        return f"{len(ks)} key moves"
    if len(sol) != 3 or sol[0] != ks[0].uci():
        return f"solution {sol} does not start with the key {ks[0].uci()}"
    b.push(ks[0])
    d = chess.Move.from_uci(sol[1])
    if d not in b.legal_moves:
        return "stored defence is illegal"
    b.push(d)
    ms = mates_in_1(b)
    if [m.uci() for m in ms] != [sol[2]]:
        return f"after the defence, mates are {[m.uci() for m in ms]}, stored {sol[2]}"
    return None


ATTACK = [chess.QUEEN, chess.ROOK, chess.ROOK, chess.BISHOP, chess.KNIGHT]
DEFEND = [chess.PAWN, chess.PAWN, chess.PAWN, chess.ROOK, chess.BISHOP, chess.KNIGHT]


def random_board(rng, side):
    """A sparse, plausible-looking position: attacker has 2-4 pieces plus pawns, defender's king near an edge."""
    b = chess.Board(None)
    att, dfn = side, not side
    edge = [s for s in chess.SQUARES if chess.square_rank(s) in ((7, 6) if att == chess.WHITE else (0, 1))]
    b.set_piece_at(rng.choice(edge), chess.Piece(chess.KING, dfn))
    home = [s for s in chess.SQUARES if chess.square_rank(s) in ((0, 1, 2) if att == chess.WHITE else (5, 6, 7))]
    free = lambda pool: [s for s in pool if b.piece_at(s) is None]  # noqa: E731
    b.set_piece_at(rng.choice(free(home)), chess.Piece(chess.KING, att))
    for pt in rng.sample(ATTACK, rng.randint(2, 3)):
        b.set_piece_at(rng.choice(free(chess.SQUARES)), chess.Piece(pt, att))
    for pt in rng.sample(DEFEND, rng.randint(2, 4)):
        b.set_piece_at(rng.choice(free(chess.SQUARES)), chess.Piece(pt, dfn))
    for _ in range(rng.randint(1, 3)):
        pawns = [s for s in free(chess.SQUARES) if 1 <= chess.square_rank(s) <= 6]
        b.set_piece_at(rng.choice(pawns), chess.Piece(chess.PAWN, att))
    b.turn = att
    return b


def plausible(b):
    if not b.is_valid() or b.is_check() or b.is_game_over():
        return False
    # no pawns on back ranks is covered by is_valid; avoid positions where the attacker is already crushing
    return len(list(b.legal_moves)) >= 8


def gen(out, seed=7):
    rng = random.Random(seed)
    m1, m2 = [], []
    sides = [chess.WHITE] * 4 + [chess.BLACK] * 2
    tries = 0
    while len(m1) < 6 or len(m2) < 6:
        tries += 1
        need1, need2 = len(m1) < 6, len(m2) < 6
        side = sides[(len(m1) if need1 else len(m2)) % 6]
        b = random_board(rng, side)
        if not plausible(b):
            continue
        ms = mates_in_1(b)
        if need1 and len(ms) == 1:
            m1.append({"fen": b.fen(), "solution": [ms[0].uci()]})
            continue
        if need2 and not ms:
            ks = keys_m2(b)
            if len(ks) != 1:
                continue
            b.push(ks[0])
            best = None
            for r in b.legal_moves:  # pick a defence that leaves exactly one mate
                b.push(r)
                mm = mates_in_1(b)
                b.pop()
                if len(mm) == 1:
                    best = (r, mm[0])
                    break
            b.pop()
            if best:
                m2.append({"fen": b.fen(), "solution": [ks[0].uci(), best[0].uci(), best[1].uci()]})
    puzzles = []
    for i, p in enumerate(m1 + m2, 1):
        kind = "mate-in-1" if i <= 6 else "mate-in-2"
        puzzles.append({"id": i, "type": kind, "fen": p["fen"], "solution": p["solution"]})
    json.dump(puzzles, open(out, "w"), indent=2)
    print(f"wrote {len(puzzles)} puzzles to {out} after {tries} random positions")


def verify(path):
    puzzles = json.load(open(path))
    bad = 0
    for p in puzzles:
        err = (check_m1 if p["type"] == "mate-in-1" else check_m2)(p["fen"], p["solution"])
        side = "white" if " w " in p["fen"] else "black"
        print(f"{p['id']:>2} {p['type']:9} {side:5} {'ok' if not err else 'FAIL: ' + err:30} {' '.join(p['solution'])}")
        bad += bool(err)
    fens = [p["fen"] for p in puzzles]
    if len(set(fens)) != len(fens):
        print("FAIL: duplicate positions")
        bad += 1
    print(f"{len(puzzles) - bad}/{len(puzzles)} verified")
    return 1 if bad else 0


if __name__ == "__main__":
    if sys.argv[1] == "gen":
        gen(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 7)
    else:
        sys.exit(verify(sys.argv[2]))
