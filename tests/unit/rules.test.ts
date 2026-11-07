import { describe, expect, it } from "vitest";
import { Game, moveToUci, parseSquare, resultText } from "../../src/chess.ts";

const uci = (g: Game) => g.legalMoves().map(moveToUci);
const play = (g: Game, ...moves: string[]) => {
  for (const m of moves) expect(g.moveUci(m), m).not.toBeNull();
};

describe("castling (item 4)", () => {
  const open = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

  it("allows both sides when legal, and moves the rook", () => {
    const g = new Game(open);
    expect(uci(g)).toEqual(expect.arrayContaining(["e1g1", "e1c1"]));
    play(g, "e1g1");
    expect(g.pos.board[parseSquare("f1")]).toBe("R");
    expect(g.pos.board[parseSquare("h1")]).toBeNull();
    play(g, "e8c8");
    expect(g.pos.board[parseSquare("d8")]).toBe("r");
    expect(g.pos.board[parseSquare("a8")]).toBeNull();
  });

  it("is lost once the king or rook has moved", () => {
    const g = new Game(open);
    play(g, "h1h2", "a8a7", "h2h1", "a7a8");
    expect(uci(g)).not.toContain("e1g1");
    expect(uci(g)).toContain("e1c1");
    play(g, "e1d1", "e8d8", "d1e1", "d8e8");
    expect(uci(g)).not.toContain("e1c1");
    expect(new Game("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1").legalMoves().some((m) => m.castle)).toBe(false);
  });

  it("is lost when the rook is captured on its square", () => {
    const g = new Game("r3k2r/8/8/8/8/8/6B1/R3K2R w KQkq - 0 1");
    play(g, "g2a8");
    expect(uci(g)).not.toContain("e8c8");
    expect(uci(g)).toContain("e8g8");
  });

  it("needs the squares between empty", () => {
    expect(uci(new Game("r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1"))).not.toEqual(
      expect.arrayContaining(["e1g1"]),
    );
    const g = new Game("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1");
    expect(uci(g)).not.toContain("e1c1");
    expect(uci(g)).toContain("e1g1");
  });

  it("is not allowed out of, through or into check", () => {
    // In check from e-file rook.
    expect(uci(new Game("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1")).some((m) => m === "e1g1" || m === "e1c1")).toBe(false);
    // f1 attacked: no kingside; queenside fine.
    let m = uci(new Game("5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1");
    // g1 attacked (into check).
    m = uci(new Game("6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(m).not.toContain("e1g1");
    // d1 attacked: no queenside. b1 attacked only: queenside still legal.
    m = uci(new Game("3r2k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(m).not.toContain("e1c1");
    m = uci(new Game("1r4k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(m).toContain("e1c1");
  });
});

describe("en passant (item 5)", () => {
  it("is available right after the double step and removes the pawn", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    play(g, "d7d5");
    expect(uci(g)).toContain("e5d6");
    play(g, "e5d6");
    expect(g.pos.board[parseSquare("d5")]).toBeNull();
    expect(g.pos.board[parseSquare("d6")]).toBe("P");
  });

  it("is gone one move later", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    play(g, "d7d5", "e1e2", "e8e7");
    expect(uci(g)).not.toContain("e5d6");
  });

  it("is not available after a single step", () => {
    const g = new Game("4k3/8/3p4/4P3/8/8/8/4K3 b - - 0 1");
    play(g, "d6d5");
    expect(uci(g)).not.toContain("e5d6");
  });

  it("is illegal if it exposes the king", () => {
    const g = new Game("8/8/8/K2pP2r/8/8/8/7k w - d6 0 1");
    expect(uci(g)).not.toContain("e5d6");
  });
});

describe("promotion (item 6)", () => {
  it("offers all four pieces and places the chosen one", () => {
    const g = new Game("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    const promos = g.legalMoves().filter((m) => m.from === parseSquare("a7")).map((m) => m.promotion);
    expect(promos.sort()).toEqual(["b", "n", "q", "r"]);
    for (const p of ["q", "r", "b", "n"] as const) {
      const h = new Game("8/P6k/8/8/8/8/8/K7 w - - 0 1");
      h.move(parseSquare("a7"), parseSquare("a8"), p);
      expect(h.pos.board[parseSquare("a8")]).toBe(p.toUpperCase());
    }
  });

  it("works for black and by capture", () => {
    const g = new Game("k7/8/8/8/8/8/1p6/R6K b - - 0 1");
    play(g, "b2a1n");
    expect(g.pos.board[parseSquare("a1")]).toBe("n");
  });
});

describe("check (item 7)", () => {
  it("is detected and must be answered", () => {
    const g = new Game("4k3/8/8/8/8/8/8/4K2R w - - 0 1");
    play(g, "h1h8");
    expect(g.status().check).toBe(true);
    expect(uci(g).every((m) => m.startsWith("e8"))).toBe(true);
    expect(g.sans.at(-1)).toBe("Rh8+");
  });

  it("pinned pieces cannot move off the line", () => {
    const g = new Game("4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1");
    expect(uci(g).filter((m) => m.startsWith("e2"))).toEqual([]);
  });
});

describe("checkmate and stalemate (item 8)", () => {
  it("fool's mate ends the game", () => {
    const g = new Game();
    play(g, "f2f3", "e7e5", "g2g4", "d8h4");
    const s = g.status();
    expect(s).toMatchObject({ over: true, reason: "checkmate", winner: "b" });
    expect(resultText(s)).toBe("Checkmate — Black wins");
    expect(g.legalMoves()).toEqual([]);
    expect(g.sans.at(-1)).toBe("Qh4#");
  });

  it("stalemate ends the game as a draw", () => {
    const g = new Game("7k/8/6Q1/8/8/8/8/K7 w - - 0 1");
    play(g, "g6f7");
    expect(g.status()).toMatchObject({ over: true, reason: "stalemate", winner: null });
    expect(g.legalMoves()).toEqual([]);
  });
});

describe("draws (item 9)", () => {
  it("threefold repetition ends the game", () => {
    const g = new Game();
    play(g, "g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1");
    expect(g.status().over).toBe(false);
    play(g, "f6g8");
    expect(g.status()).toMatchObject({ over: true, reason: "threefold" });
    expect(g.legalMoves()).toEqual([]);
  });

  it("counts positions, not just moves (different castling rights differ)", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    // Rook moves lose kingside rights, so returning doesn't recreate the start position.
    play(g, "h1g1", "h8g8", "g1h1", "g8h8", "h1g1", "h8g8", "g1h1", "g8h8");
    expect(g.status().over).toBe(false);
    play(g, "h1g1", "h8g8");
    expect(g.status()).toMatchObject({ over: true, reason: "threefold" });
  });

  it("50-move rule: 100 half-moves without capture or pawn move", () => {
    const g = new Game("4k3/8/8/8/8/8/8/R3K3 w - - 98 80");
    play(g, "a1a2");
    expect(g.status().over).toBe(false);
    play(g, "e8e7");
    expect(g.status()).toMatchObject({ over: true, reason: "fifty-move" });
    expect(resultText(g.status())).toBe("Draw by the 50-move rule");
  });

  it("a pawn move or capture resets the clock", () => {
    const g = new Game("4k3/8/8/8/8/8/4P3/R3K3 w - - 99 80");
    play(g, "e2e3");
    expect(g.pos.halfmove).toBe(0);
    expect(g.status().over).toBe(false);
  });

  it("checkmate on the 100th half-move is still checkmate", () => {
    const g = new Game("k7/8/1K6/8/8/8/8/7R w - - 99 80");
    play(g, "h1h8");
    expect(g.status()).toMatchObject({ reason: "checkmate", winner: "w" });
  });
});
