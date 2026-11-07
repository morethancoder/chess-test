import { describe, expect, it } from "vitest";
import {
  START_FEN, applyMove, inCheck, legalMoves, outcome, parseFen, parseUci, perft, repetitionKey, sq, toFen, toUci,
} from "../../src/engine.ts";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const ucis = (fen: string) => legalMoves(parseFen(fen)).map(toUci);
const play = (fen: string, ...moves: string[]) => {
  let p = parseFen(fen);
  for (const u of moves) {
    const m = parseUci(p, u);
    if (!m) throw new Error("illegal " + u);
    p = applyMove(p, m);
  }
  return p;
};

describe("perft", () => {
  it.each([[1, 20], [2, 400], [3, 8902], [4, 197281]])("start depth %i", (d, n) => {
    expect(perft(parseFen(START_FEN), d)).toBe(n);
  });
  it.each([[1, 48], [2, 2039], [3, 97862]])("kiwipete depth %i", (d, n) => {
    expect(perft(parseFen(KIWIPETE), d)).toBe(n);
  });
});

describe("fen", () => {
  it("round-trips", () => expect(toFen(parseFen(KIWIPETE))).toBe(KIWIPETE));
});

describe("legal moves only", () => {
  it("pinned piece cannot leave the pin", () => {
    expect(ucis("4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1").filter((m) => m.startsWith("e2"))).not.toContain("e2d2");
  });
  it("king cannot step into check", () => {
    expect(ucis("4k3/8/8/8/8/8/r7/4K3 w - - 0 1")).not.toContain("e1e2");
  });
  it("must answer check", () => {
    const moves = ucis("4k3/8/8/8/8/8/4r3/R3K3 w - - 0 1");
    expect(moves.sort()).toEqual(["e1d1", "e1f1", "e1e2"].sort());
  });
});

describe("castling", () => {
  const base = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  it("allowed on both sides", () => {
    const m = ucis(base);
    expect(m).toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("moves the rook too", () => {
    const p = play(base, "e1g1");
    expect(p.board[sq("f1")]).toBe("wR");
    expect(p.board[sq("h1")]).toBeNull();
    const q = play(base, "e1c1");
    expect(q.board[sq("d1")]).toBe("wR");
  });
  it("not without rights", () => {
    expect(ucis("r3k2r/8/8/8/8/8/8/R3K2R w Qkq - 0 1")).not.toContain("e1g1");
    expect(ucis("r3k2r/8/8/8/8/8/8/R3K2R w Kkq - 0 1")).not.toContain("e1c1");
  });
  it("rights are lost once king or rook has moved", () => {
    const p = play(base, "h1h2", "a8a7", "h2h1", "a7a8");
    expect(ucis(toFen(p))).not.toContain("e1g1");
    expect(ucis(toFen(p))).toContain("e1c1");
  });
  it("not with pieces between", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/RN2KB1R w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("not out of check", () => {
    expect(ucis("r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1")).not.toContain("e1g1");
  });
  it("not through check", () => {
    const m = ucis("r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("not into check", () => {
    const m = ucis("r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
  });
  it("queenside: b1 may be attacked, d1/c1 may not", () => {
    expect(ucis("r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1")).toContain("e1c1");
    expect(ucis("r3k2r/8/8/8/8/8/2r5/R3K2R w KQkq - 0 1")).not.toContain("e1c1");
  });
  it("black castles too", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
    expect(m).toContain("e8g8");
    expect(m).toContain("e8c8");
  });
});

describe("en passant", () => {
  it("available right after the double step, and removes the pawn", () => {
    const p = play("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1", "d7d5");
    expect(ucis(toFen(p))).toContain("e5d6");
    const q = play(toFen(p), "e5d6");
    expect(q.board[sq("d5")]).toBeNull();
    expect(q.board[sq("d6")]).toBe("wP");
  });
  it("not one move later", () => {
    const p = play("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1", "d7d5", "e1e2", "e8e7");
    expect(ucis(toFen(p))).not.toContain("e5d6");
  });
  it("not after a single step", () => {
    const p = play("4k3/8/3p4/4P3/8/8/8/4K3 b - - 0 1", "d6d5");
    expect(ucis(toFen(p))).not.toContain("e5d6");
  });
  it("illegal if it exposes the king", () => {
    // white king and rook on rank 5 with both pawns between would be exposed
    const m = ucis("8/8/8/K2pP2r/8/8/8/4k3 w - d6 0 1");
    expect(m).not.toContain("e5d6");
  });
});

describe("promotion", () => {
  it("offers all four pieces", () => {
    const m = ucis("8/P6k/8/8/8/8/8/4K3 w - - 0 1").filter((x) => x.startsWith("a7a8"));
    expect(m.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
  });
  it("replaces the pawn", () => {
    const p = play("8/P6k/8/8/8/8/8/4K3 w - - 0 1", "a7a8n");
    expect(p.board[sq("a8")]).toBe("wN");
  });
  it("works with capture, for black", () => {
    expect(ucis("4k3/8/8/8/8/8/p7/1R2K3 b - - 0 1")).toContain("a2b1q");
  });
});

describe("check", () => {
  it("is detected", () => {
    expect(inCheck(parseFen("4k3/8/8/8/8/8/4R3/4K3 b - - 0 1"))).toBe(true);
    expect(inCheck(parseFen(START_FEN))).toBe(false);
  });
});

describe("game end", () => {
  it("checkmate (fool's mate)", () => {
    const p = play(START_FEN, "f2f3", "e7e5", "g2g4", "d8h4");
    const o = outcome(p, [repetitionKey(p)]);
    expect(o).toEqual({ over: true, kind: "checkmate", winner: "b" });
  });
  it("stalemate", () => {
    const p = parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(outcome(p, [])).toEqual({ over: true, kind: "stalemate" });
  });
  it("threefold repetition", () => {
    let p = parseFen(START_FEN);
    const keys = [repetitionKey(p)];
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    let last = outcome(p, keys);
    for (let i = 0; i < 8; i++) {
      expect(last.over).toBe(false);
      p = play(toFen(p), cycle[i % 4]);
      keys.push(repetitionKey(p));
      last = outcome(p, keys);
    }
    expect(last).toEqual({ over: true, kind: "threefold" });
  });
  it("50-move rule", () => {
    expect(outcome(parseFen("4k3/8/8/8/8/8/R7/4K3 w - - 99 80"), [])).toEqual({ over: false });
    const p = play("4k3/8/8/8/8/8/R7/4K3 w - - 99 80", "a2a3");
    expect(outcome(p, [])).toEqual({ over: true, kind: "fifty-move" });
  });
  it("50-move counter resets on a pawn move", () => {
    const p = play("4k3/8/8/8/8/4P3/R7/4K3 w - - 99 80", "e3e4");
    expect(p.halfmove).toBe(0);
  });
  it("checkmate beats the 50-move rule", () => {
    const p = parseFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 100 80");
    expect(outcome(p, []).over && (outcome(p, []) as { kind: string }).kind).toBe("checkmate");
  });
});
