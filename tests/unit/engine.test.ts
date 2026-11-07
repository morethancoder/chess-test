import { describe, expect, it } from "vitest";
import {
  START_FEN, applyMove, findMove, inCheck, legalMoves, moveToUci, outcome, parseFen, parseUci, perft, positionKey, sq, toFen,
} from "../../src/engine.ts";
import type { Position } from "../../src/engine.ts";
import { Game } from "../../src/game.ts";

const KIWI = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const ucis = (fen: string) => legalMoves(parseFen(fen)).map(moveToUci);

describe("perft", () => {
  it.each([[1, 20], [2, 400], [3, 8902], [4, 197281]])("start position depth %i = %i", (d, n) => {
    expect(perft(parseFen(START_FEN), d)).toBe(n);
  });
  it.each([[1, 48], [2, 2039], [3, 97862]])("Kiwipete depth %i = %i", (d, n) => {
    expect(perft(parseFen(KIWI), d)).toBe(n);
  });
});

describe("fen", () => {
  it("round trips", () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
    expect(toFen(parseFen(KIWI))).toBe(KIWI);
  });
  it("rejects garbage", () => {
    expect(() => parseFen("nonsense")).toThrow();
  });
});

describe("legality (3)", () => {
  it("a pinned piece cannot leave the pin line", () => {
    expect(ucis("4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1").filter((m) => m.startsWith("e2"))).toEqual([]);
  });
  it("in check only check-resolving moves are legal", () => {
    expect(ucis("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1").sort()).toEqual(["e1d1", "e1e2", "e1f1"]);
  });
});

describe("castling (4)", () => {
  it("is offered on both sides when legal", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(m).toContain("e1g1");
    expect(m).toContain("e1c1");
    expect(ucis("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1")).toEqual(expect.arrayContaining(["e8g8", "e8c8"]));
  });
  it("moves the rook too", () => {
    const p = applyMove(parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), parseUci("e1g1"));
    expect(p.board[sq("f1")]).toBe("wR");
    expect(p.board[sq("h1")]).toBeNull();
  });
  it("needs the rights (king or rook moved)", () => {
    expect(ucis("r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1")).not.toContain("e1g1");
    let p = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    p = applyMove(p, parseUci("h1h2"));
    p = applyMove(p, parseUci("a8a7"));
    p = applyMove(p, parseUci("h2h1"));
    p = applyMove(p, parseUci("a7a8"));
    const m = legalMoves(p).map(moveToUci);
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("needs empty squares between", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("not out of, through or into check", () => {
    expect(ucis("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1")).not.toContain("e1g1"); // in check
    expect(ucis("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1")).not.toContain("e1g1"); // through f1
    expect(ucis("4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1")).not.toContain("e1g1"); // into g1
    expect(ucis("3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).not.toContain("e1c1"); // through d1
    // the b-file may be attacked for queenside castling
    expect(ucis("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).toContain("e1c1");
  });
});

describe("en passant (5)", () => {
  it("is legal right after the double step", () => {
    let p = parseFen("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    p = applyMove(p, parseUci("d7d5"));
    const m = legalMoves(p).find((x) => moveToUci(x) === "e5d6")!;
    expect(m).toBeTruthy();
    const after = applyMove(p, m);
    expect(after.board[sq("d5")]).toBeNull();
    expect(after.board[sq("d6")]).toBe("wP");
  });
  it("is gone one move later", () => {
    let p = parseFen("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    p = applyMove(p, parseUci("d7d5"));
    p = applyMove(p, parseUci("e1e2"));
    p = applyMove(p, parseUci("e8e7"));
    expect(legalMoves(p).map(moveToUci)).not.toContain("e5d6");
  });
  it("cannot expose the king (horizontal pin)", () => {
    expect(ucis("8/8/8/KpP4r/8/8/8/7k w - b6 0 1")).not.toContain("c5b6");
  });
});

describe("promotion (6)", () => {
  it("offers q, r, b, n", () => {
    const m = legalMoves(parseFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1")).filter((x) => x.from === sq("a7"));
    expect(m.map((x) => x.promo).sort()).toEqual(["b", "n", "q", "r"]);
  });
  it("replaces the pawn with the chosen piece", () => {
    const p = parseFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const mv = findMove(p, sq("a7"), sq("a8"), "n")!;
    expect(applyMove(p, mv).board[sq("a8")]).toBe("wN");
  });
});

describe("check (7)", () => {
  it("is detected", () => {
    expect(inCheck(parseFen("4k3/8/8/8/8/8/4R3/4K3 b - - 0 1"))).toBe(true);
    expect(inCheck(parseFen(START_FEN))).toBe(false);
  });
});

describe("checkmate and stalemate (8)", () => {
  it("fool's mate", () => {
    const g = new Game();
    for (const m of ["f2f3", "e7e5", "g2g4", "d8h4"]) g.play(parseUci(m));
    expect(g.result).toMatchObject({ over: true, kind: "checkmate", winner: "b" });
  });
  it("stalemate", () => {
    const o = outcome(parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), []);
    expect(o).toMatchObject({ over: true, kind: "stalemate" });
  });
  it("mid-game is not over", () => {
    expect(outcome(parseFen(START_FEN), [positionKey(parseFen(START_FEN))])).toEqual({ over: false });
  });
});

describe("draws (9)", () => {
  it("threefold repetition ends the game automatically", () => {
    const g = new Game();
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    for (const m of shuffle) g.play(parseUci(m));
    expect(g.result.over).toBe(false);
    for (const m of shuffle) g.play(parseUci(m));
    expect(g.result).toMatchObject({ over: true, kind: "threefold" });
  });
  it("50-move rule", () => {
    const p: Position = parseFen("4k3/8/8/8/8/8/R7/4K3 w - - 99 80");
    const g = new Game(toFen(p));
    expect(g.result.over).toBe(false);
    g.play(parseUci("a2a3"));
    expect(g.result).toMatchObject({ over: true, kind: "fifty" });
  });
  it("a pawn move or capture resets the clock", () => {
    const p = applyMove(parseFen("4k3/8/8/8/8/8/P7/4K3 w - - 99 80"), parseUci("a2a3"));
    expect(p.halfmove).toBe(0);
  });
  it("mate on the 100th half-move is a win, not a draw", () => {
    const g = new Game("7k/8/6K1/8/8/8/8/R7 w - - 99 80");
    g.play(parseUci("a1a8"));
    expect(g.result).toMatchObject({ kind: "checkmate" });
  });
});
