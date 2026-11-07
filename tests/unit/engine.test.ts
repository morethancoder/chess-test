import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Game, START_FEN, legalMoves, parseFen, parseUci, perft, resultText, sqIndex, uci } from "../../src/engine.ts";

const KIWI = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const movesOf = (fen: string) => legalMoves(parseFen(fen)).map(uci);
const play = (g: Game, ...us: string[]) => us.forEach((u) => expect(g.play(parseUci(u)), u).toBe(true));

describe("perft (16)", () => {
  it.each([[1, 20], [2, 400], [3, 8902], [4, 197281]])("start depth %i = %i", (d, n) => {
    expect(perft(parseFen(START_FEN), d)).toBe(n);
  });
  it.each([[1, 48], [2, 2039], [3, 97862]])("kiwipete depth %i = %i", (d, n) => {
    expect(perft(parseFen(KIWI), d)).toBe(n);
  });
});

describe("legal moves (3)", () => {
  it("rejects moves that leave the king in check", () => {
    // White rook e2 is pinned by the black rook on e8.
    const m = movesOf("4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1");
    expect(m).toContain("e2e5");
    expect(m).not.toContain("e2a2");
  });
  it("Game.play refuses an illegal move", () => {
    const g = new Game();
    expect(g.play(parseUci("e2e5"))).toBe(false);
    expect(g.state.turn).toBe("w");
  });
});

describe("castling (4)", () => {
  const base = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  it("allows both sides when clear", () => {
    const m = movesOf(base);
    expect(m).toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("moves the rook too", () => {
    const g = new Game(base);
    play(g, "e1g1");
    expect(g.state.board[sqIndex("f1")]).toBe("wR");
    expect(g.state.board[sqIndex("h1")]).toBeNull();
  });
  it("needs empty squares between", () => {
    const m = movesOf("r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("is not allowed out of check", () => {
    expect(movesOf("r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1")).not.toContain("e1g1");
  });
  it("is not allowed through an attacked square", () => {
    const m = movesOf("r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("is not allowed into check", () => {
    const m = movesOf("r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
  });
  it("is allowed when only the b-file square is attacked (queenside)", () => {
    expect(movesOf("r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1")).toContain("e1c1");
  });
  it("is lost after the king or rook has moved", () => {
    const g = new Game(base);
    play(g, "h1g1", "a8a7", "g1h1", "a7a8");
    const m = g.legal().map(uci);
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("works for black", () => {
    const m = movesOf("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
    expect(m).toContain("e8g8");
    expect(m).toContain("e8c8");
  });
});

describe("en passant (5)", () => {
  it("is available right after the double step", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    play(g, "d7d5");
    expect(g.legal().map(uci)).toContain("e5d6");
    play(g, "e5d6");
    expect(g.state.board[sqIndex("d5")]).toBeNull();
    expect(g.state.board[sqIndex("d6")]).toBe("wP");
  });
  it("is gone one move later", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    play(g, "d7d5", "e1e2", "e8e7");
    expect(g.legal().map(uci)).not.toContain("e5d6");
  });
  it("is not offered after a single step", () => {
    const g = new Game("4k3/8/3p4/4P3/8/8/8/4K3 b - - 0 1");
    play(g, "d6d5");
    expect(g.legal().map(uci)).not.toContain("e5d6");
  });
});

describe("promotion (6)", () => {
  it("offers all four pieces", () => {
    const m = movesOf("8/P6k/8/8/8/8/8/K7 w - - 0 1").filter((x) => x.startsWith("a7a8"));
    expect(m.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
  });
  it("replaces the pawn with the chosen piece", () => {
    const g = new Game("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    expect(g.play(parseUci("a7a8"))).toBe(false); // a piece must be chosen
    play(g, "a7a8n");
    expect(g.state.board[sqIndex("a8")]).toBe("wN");
  });
});

describe("check, mate, stalemate (7, 8)", () => {
  it("fool's mate ends the game", () => {
    const g = new Game();
    play(g, "f2f3", "e7e5", "g2g4", "d8h4");
    expect(g.result).toEqual({ kind: "checkmate", winner: "b" });
    expect(resultText(g.result!)).toContain("Black wins");
    expect(g.legal()).toEqual([]);
  });
  it("detects stalemate", () => {
    const g = new Game("7k/5Q2/8/6K1/8/8/8/8 w - - 0 1");
    play(g, "g5g6");
    expect(g.result).toEqual({ kind: "stalemate" });
  });
  it("undo clears the result", () => {
    const g = new Game();
    play(g, "f2f3", "e7e5", "g2g4", "d8h4");
    g.undo();
    expect(g.result).toBeNull();
  });
});

describe("draws (9)", () => {
  it("threefold repetition ends the game", () => {
    const g = new Game();
    play(g, "g1f3", "g8f6", "f3g1", "f6g8");
    expect(g.result).toBeNull();
    play(g, "g1f3", "g8f6", "f3g1");
    expect(g.result).toBeNull();
    play(g, "f6g8");
    expect(g.result).toEqual({ kind: "repetition" });
  });
  it("50-move rule ends the game", () => {
    const g = new Game("4k3/8/8/8/8/8/R7/4K3 w - - 98 80");
    play(g, "a2a3");
    expect(g.result).toBeNull();
    play(g, "e8d8");
    expect(g.result).toEqual({ kind: "fifty" });
  });
  it("a pawn move resets the clock", () => {
    const g = new Game("4k3/p7/8/8/8/8/R7/4K3 b - - 99 80");
    play(g, "a7a6");
    expect(g.result).toBeNull();
  });
  it("mate on the 100th ply beats the 50-move draw", () => {
    const g = new Game("6k1/5ppp/8/8/8/8/8/R3K3 w - - 99 80");
    play(g, "a1a8");
    expect(g.result?.kind).toBe("checkmate");
  });
});

describe("puzzles", () => {
  const puzzles = JSON.parse(readFileSync("public/puzzles.json", "utf8")) as { fen: string; solution: string[]; type: string }[];
  it("has 12 puzzles", () => expect(puzzles).toHaveLength(12));
  it.each(puzzles.map((p, i) => [i + 1, p] as const))("puzzle %i solution is legal and ends in mate", (_n, p) => {
    const g = new Game(p.fen);
    for (const u of p.solution) play(g, u);
    expect(g.result?.kind).toBe("checkmate");
  });
});
