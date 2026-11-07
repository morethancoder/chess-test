import { describe, expect, it } from "vitest";
import { Game, START_FEN, findMove, inCheck, legalMoves, moveToUci, parseFen, perft, sqIndex, toFen } from "../../src/engine.ts";

const KIWI = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const ucis = (fen: string) => legalMoves(parseFen(fen)).map(moveToUci);

function playAll(g: Game, moves: string[]) {
  for (const u of moves) {
    const m = findMove(g.pos, u);
    if (!m) throw new Error(`illegal ${u} in ${toFen(g.pos)}`);
    g.play(m);
  }
}

describe("perft", () => {
  const start = parseFen(START_FEN);
  it.each([[1, 20], [2, 400], [3, 8902], [4, 197281]])("start depth %i", (d, n) => {
    expect(perft(start, d)).toBe(n);
  });
  const kiwi = parseFen(KIWI);
  it.each([[1, 48], [2, 2039], [3, 97862]])("kiwipete depth %i", (d, n) => {
    expect(perft(kiwi, d)).toBe(n);
  });
});

describe("fen", () => {
  it("round-trips", () => {
    expect(toFen(parseFen(KIWI))).toBe(KIWI);
  });
});

describe("legal moves (3)", () => {
  it("pinned piece cannot move off the pin line", () => {
    expect(ucis("4k3/8/8/8/8/8/4r3/4KR2 w - - 0 1").filter((u) => u.startsWith("f1"))).toEqual([]);
  });
  it("must resolve check", () => {
    const m = ucis("4k3/8/8/8/8/8/4r3/R3K3 w - - 0 1");
    expect(m.sort()).toEqual(["e1d1", "e1f1", "e1e2"].sort());
  });
});

describe("castling (4)", () => {
  it("allowed both sides when clear", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(m).toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("moves the rook", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    playAll(g, ["e1g1"]);
    expect(g.pos.board[sqIndex("f1")]).toBe("wR");
    expect(g.pos.board[sqIndex("h1")]).toBeNull();
  });
  it("not without rights", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("rights lost after rook or king moves", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    playAll(g, ["h1h2", "a8a7", "h2h1", "a7a8"]);
    const m = legalMoves(g.pos).map(moveToUci);
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("not with pieces between", () => {
    expect(ucis("r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1")).not.toContain("e1c1");
    expect(ucis("r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1")).not.toContain("e1g1");
  });
  it("not out of check", () => {
    const m = ucis("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1");
    expect(m).not.toContain("e1g1");
    const m2 = ucis("4k3/4r3/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(m2).not.toContain("e1g1");
  });
  it("not through check", () => {
    expect(ucis("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1")).not.toContain("e1g1");
    expect(ucis("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1")).toContain("e1c1");
  });
  it("not into check", () => {
    expect(ucis("4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1")).not.toContain("e1g1");
  });
  it("queenside allowed when only b1 is attacked", () => {
    expect(ucis("4k3/8/8/8/8/8/1r6/R3K2R w KQ - 0 1")).toContain("e1c1");
  });
  it("black castles too", () => {
    expect(ucis("r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1")).toEqual(expect.arrayContaining(["e8g8", "e8c8"]));
  });
});

describe("en passant (5)", () => {
  it("available right after the double step, and removes the pawn", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    playAll(g, ["d7d5"]);
    expect(legalMoves(g.pos).map(moveToUci)).toContain("e5d6");
    playAll(g, ["e5d6"]);
    expect(g.pos.board[sqIndex("d5")]).toBeNull();
    expect(g.pos.board[sqIndex("d6")]).toBe("wP");
  });
  it("not one move later", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/7P/4K3 b - - 0 1");
    playAll(g, ["d7d5", "h2h3", "e8e7"]);
    expect(legalMoves(g.pos).map(moveToUci)).not.toContain("e5d6");
  });
  it("not for a single step", () => {
    const g = new Game("4k3/8/3p4/4P3/8/8/8/4K3 b - - 0 1");
    playAll(g, ["d6d5"]);
    expect(legalMoves(g.pos).map(moveToUci)).not.toContain("e5d6");
  });
  it("illegal when it exposes own king", () => {
    // white king and both pawns on rank 5 with a black rook: capture would open the rank
    const g = new Game("8/8/8/K2pP2r/8/8/8/4k3 w - d6 0 1");
    expect(legalMoves(g.pos).map(moveToUci)).not.toContain("e5d6");
  });
});

describe("promotion (6)", () => {
  it("offers all four pieces", () => {
    const m = ucis("8/P6k/8/8/8/8/8/K7 w - - 0 1").filter((u) => u.startsWith("a7a8"));
    expect(m.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
  });
  it("replaces the pawn with the chosen piece", () => {
    const g = new Game("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    playAll(g, ["a7a8n"]);
    expect(g.pos.board[sqIndex("a8")]).toBe("wN");
  });
  it("works with capture and for black", () => {
    const g = new Game("1r5k/P7/8/8/8/8/p7/K7 w - - 0 1");
    expect(ucis("1r5k/P7/8/8/8/8/p7/K7 w - - 0 1")).toContain("a7b8q");
    playAll(g, ["a7b8r", "h8g7"]);
    expect(g.pos.board[sqIndex("b8")]).toBe("wR");
  });
});

describe("check (7)", () => {
  it("is detected", () => {
    expect(inCheck(parseFen("4k3/8/8/8/8/8/4R3/4K3 b - - 0 1"))).toBe(true);
    expect(inCheck(parseFen("4k3/8/8/8/8/8/3R4/4K3 b - - 0 1"))).toBe(false);
  });
});

describe("checkmate and stalemate (8)", () => {
  it("fool's mate", () => {
    const g = new Game();
    playAll(g, ["f2f3", "e7e5", "g2g4", "d8h4"]);
    const o = g.outcome();
    expect(o.over && o.reason).toBe("checkmate");
    expect(o.over && o.result).toBe("0-1");
  });
  it("stalemate", () => {
    const g = new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    const o = g.outcome();
    expect(o.over && o.reason).toBe("stalemate");
    expect(o.over && o.result).toBe("1/2-1/2");
  });
  it("ongoing game is not over", () => {
    expect(new Game().outcome().over).toBe(false);
  });
});

describe("draws (9)", () => {
  it("threefold repetition", () => {
    const g = new Game();
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    playAll(g, shuffle);
    expect(g.outcome().over).toBe(false);
    playAll(g, shuffle);
    const o = g.outcome();
    expect(o.over && o.reason).toBe("threefold repetition");
  });
  it("repetition does not count when castling rights differ", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    playAll(g, ["a1b1", "a8b8", "b1a1", "b8a8", "a1b1", "a8b8", "b1a1", "b8a8"]);
    expect(g.outcome().over).toBe(false);
  });
  it("50-move rule at 100 half-moves", () => {
    const g = new Game("4k3/8/8/8/8/8/R7/4K3 w - - 98 80");
    expect(g.outcome().over).toBe(false);
    playAll(g, ["a2a3"]);
    expect(g.outcome().over).toBe(false);
    playAll(g, ["e8d8"]);
    const o = g.outcome();
    expect(o.over && o.reason).toBe("fifty-move rule");
  });
  it("pawn move or capture resets the counter", () => {
    const g = new Game("4k3/8/8/8/8/8/P6R/4K3 w - - 99 80");
    playAll(g, ["a2a3"]);
    expect(g.pos.halfmove).toBe(0);
    expect(g.outcome().over).toBe(false);
  });
});
