import { describe, expect, it } from "vitest";
import { Game, inCheck, legalMoves, parseFen, parseUci, perft, START_FEN, toFen, uci } from "../../src/chess.ts";

const KIWI = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const play = (g: Game, ...moves: string[]) => {
  for (const m of moves) expect(g.play(parseUci(m)), m).toBe(true);
};
const ucis = (fen: string) => legalMoves(parseFen(fen)).map(uci);

describe("perft", () => {
  it.each([[1, 20], [2, 400], [3, 8902], [4, 197281]])("start depth %i", (d, n) => {
    expect(perft(parseFen(START_FEN), d)).toBe(n);
  });
  it.each([[1, 48], [2, 2039], [3, 97862]])("kiwipete depth %i", (d, n) => {
    expect(perft(parseFen(KIWI), d)).toBe(n);
  });
});

describe("legality", () => {
  it("rejects illegal moves", () => {
    const g = new Game();
    expect(g.play(parseUci("e2e5"))).toBe(false);
    expect(g.play(parseUci("e7e5"))).toBe(false); // wrong side
    expect(g.play(parseUci("e2e4"))).toBe(true);
  });
  it("pinned piece cannot move", () => {
    expect(ucis("4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1").some((m) => m.startsWith("e2"))).toBe(false);
  });
});

describe("castling", () => {
  it("allows both sides when legal", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(m).toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("moves the rook", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    play(g, "e1g1");
    expect(toFen(g.position).split(" ")[0]).toBe("r3k2r/8/8/8/8/8/8/R4RK1");
  });
  it("needs unmoved king and rook (rights)", () => {
    expect(ucis("r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1")).not.toContain("e1g1");
    expect(ucis("r3k2r/8/8/8/8/8/8/R3K2R w Q - 0 1")).not.toContain("e1g1");
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    play(g, "h1h2", "a8a7", "h2h1", "a7a8");
    expect(g.legal().map(uci)).not.toContain("e1g1");
    expect(g.legal().map(uci)).toContain("e1c1");
  });
  it("needs empty squares between", () => {
    expect(ucis("r3k2r/8/8/8/8/8/8/R2QK2R w KQkq - 0 1")).not.toContain("e1c1");
    expect(ucis("r3k2r/8/8/8/8/8/8/R1B1K2R w KQkq - 0 1")).not.toContain("e1c1");
  });
  it("not out of check", () => {
    expect(ucis("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1")).not.toContain("e1g1");
  });
  it("not through check", () => {
    expect(ucis("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1")).not.toContain("e1g1");
    expect(ucis("4k3/8/8/8/8/8/3r4/R3K2R w KQ - 0 1")).not.toContain("e1c1");
  });
  it("not into check", () => {
    expect(ucis("4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1")).not.toContain("e1g1");
  });
  it("queenside is allowed when only b1 is attacked", () => {
    expect(ucis("4k3/8/8/8/8/8/1r6/R3K2R w KQ - 0 1")).toContain("e1c1");
  });
});

describe("en passant", () => {
  it("allowed right after the double step and removes the pawn", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    play(g, "d7d5");
    expect(g.legal().map(uci)).toContain("e5d6");
    play(g, "e5d6");
    expect(g.position.board[parseUci("d5d5").from]).toBeNull();
  });
  it("not allowed one move later", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/7P/4K3 b - - 0 1");
    play(g, "d7d5", "h2h3", "e8e7");
    expect(g.legal().map(uci)).not.toContain("e5d6");
  });
});

describe("promotion", () => {
  it("offers q r b n", () => {
    const m = ucis("8/P6k/8/8/8/8/8/K7 w - - 0 1").filter((x) => x.startsWith("a7a8"));
    expect(m.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
  });
  it("needs a piece choice and places it", () => {
    const g = new Game("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    expect(g.isPromotion(parseUci("a7a8").from, parseUci("a7a8").to)).toBe(true);
    expect(g.play(parseUci("a7a8"))).toBe(false);
    play(g, "a7a8n");
    expect(g.position.board[0]).toBe("wN");
  });
});

describe("check", () => {
  it("is detected", () => {
    expect(inCheck(parseFen("4k3/8/8/8/8/8/8/4RK2 b - - 0 1"))).toBe(true);
    const g = new Game("4k3/8/8/8/8/8/8/4RK2 w - - 0 1");
    expect(g.status()).toEqual({ kind: "playing", check: false });
    play(g, "f1f2");
    expect(g.status()).toMatchObject({ kind: "playing", check: true });
  });
});

describe("game end", () => {
  it("fool's mate is checkmate", () => {
    const g = new Game();
    play(g, "f2f3", "e7e5", "g2g4", "d8h4");
    expect(g.status()).toEqual({ kind: "checkmate", winner: "b" });
    expect(g.play(parseUci("a2a3"))).toBe(false);
  });
  it("stalemate", () => {
    expect(new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").status()).toEqual({ kind: "stalemate" });
  });
  it("threefold repetition draws automatically", () => {
    const g = new Game();
    play(g, "g1f3", "g8f6", "f3g1", "f6g8");
    expect(g.status().kind).toBe("playing");
    play(g, "g1f3", "g8f6", "f3g1", "f6g8");
    expect(g.status().kind).toBe("threefold");
  });
  it("50-move rule draws automatically", () => {
    const g = new Game("4k3/8/8/8/8/8/r7/R3K3 w - - 98 80");
    play(g, "e1d1");
    expect(g.status().kind).toBe("playing");
    play(g, "a2a3");
    expect(g.status().kind).toBe("fifty");
  });
  it("a mating move on halfmove 100 is mate, not a draw", () => {
    const g = new Game("6k1/5ppp/8/8/8/8/8/R3K3 w - - 99 80");
    play(g, "a1a8");
    expect(g.status().kind).toBe("checkmate");
  });
});
