import { describe, expect, it } from "vitest";
import { Game, Position, moveToUci, parseSquare } from "../../src/chess.ts";

const uciMoves = (fen: string) => new Game(fen).moves().map(moveToUci);
const playAll = (g: Game, list: string[]) => {
  for (const u of list) {
    const m = g.findUci(u);
    if (!m) throw new Error(`not legal: ${u}`);
    g.play(m);
  }
};

describe("legal moves (item 3)", () => {
  it("rejects moves that leave the king in check", () => {
    // The e2 knight is pinned by the rook on e8.
    const moves = uciMoves("4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(moves.some((m) => m.startsWith("e2"))).toBe(false);
  });
  it("Game.play throws on an illegal move", () => {
    const g = new Game();
    expect(() => g.play({ from: parseSquare("e2"), to: parseSquare("e5"), color: "w", piece: "p", flag: "normal" })).toThrow();
  });
});

describe("castling (item 4)", () => {
  const base = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  it("allows both sides when legal", () => {
    const m = uciMoves(base);
    expect(m).toContain("e1g1");
    expect(m).toContain("e1c1");
    const b = uciMoves(base.replace(" w ", " b "));
    expect(b).toContain("e8g8");
    expect(b).toContain("e8c8");
  });
  it("moves the rook too", () => {
    const g = new Game(base);
    playAll(g, ["e1g1"]);
    expect(g.pos.fen().split(" ")[0]).toBe("r3k2r/8/8/8/8/8/8/R4RK1");
    playAll(g, ["e8c8"]);
    expect(g.pos.fen().split(" ")[0]).toBe("2kr3r/8/8/8/8/8/8/R4RK1");
  });
  it("not after the king has moved", () => {
    const g = new Game(base);
    playAll(g, ["e1f1", "a8b8", "f1e1", "b8a8"]);
    expect(g.moves().map(moveToUci)).not.toContain("e1g1");
    expect(g.moves().map(moveToUci)).not.toContain("e1c1");
  });
  it("not on the side whose rook has moved", () => {
    const g = new Game(base);
    playAll(g, ["h1h2", "a8a7", "h2h1", "a7a8"]);
    const m = g.moves().map(moveToUci);
    expect(m).not.toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("not when the rook was captured", () => {
    const g = new Game("r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1");
    playAll(g, ["g2h1"]);
    expect(g.moves().map(moveToUci)).not.toContain("e1g1");
  });
  it("not with pieces in between", () => {
    const m = uciMoves("r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("not out of check", () => {
    const m = uciMoves("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1".replace("r3k2r/8", "r3k2r/4r3"));
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("not through check", () => {
    // Black rook on f8 covers f1; black rook on d8 covers d1.
    const m = uciMoves("3rkr2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("not into check", () => {
    const m = uciMoves("2r1k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("queen side allowed when only b1 is attacked", () => {
    const m = uciMoves("1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1");
    expect(m).toContain("e1c1");
  });
});

describe("en passant (item 5)", () => {
  it("is available right after the double step and removes the pawn", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    playAll(g, ["d7d5"]);
    expect(g.moves().map(moveToUci)).toContain("e5d6");
    playAll(g, ["e5d6"]);
    expect(g.pos.fen().split(" ")[0]).toBe("4k3/8/3P4/8/8/8/8/4K3");
  });
  it("is gone one move later", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    playAll(g, ["d7d5", "e1f1", "e8f8"]);
    expect(g.moves().map(moveToUci)).not.toContain("e5d6");
  });
  it("is not available after a single step", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    playAll(g, ["d7d6", "e1f1", "d6d5"]);
    expect(g.moves().map(moveToUci)).not.toContain("e5d6");
  });
  it("is illegal when it exposes the king", () => {
    // Capturing en passant would clear the fifth rank between king and rook.
    const m = uciMoves("8/8/8/KPp4r/8/8/8/4k3 w - c6 0 2");
    expect(m).not.toContain("b5c6");
  });
});

describe("promotion (item 6)", () => {
  it("offers all four pieces", () => {
    const m = uciMoves("8/P3k3/8/8/8/8/8/4K3 w - - 0 1").filter((u) => u.startsWith("a7a8"));
    expect(m.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
  });
  it("places the chosen piece", () => {
    for (const p of ["q", "r", "b", "n"]) {
      const g = new Game("8/P3k3/8/8/8/8/8/4K3 w - - 0 1");
      playAll(g, ["a7a8" + p]);
      expect(g.pos.fen().split(" ")[0]).toBe(`${p.toUpperCase()}7/4k3/8/8/8/8/8/4K3`);
    }
  });
  it("works with a capture, for black too", () => {
    const g = new Game("4k3/8/8/8/8/8/p7/1N2K3 b - - 0 1");
    playAll(g, ["a2b1n"]);
    expect(g.pos.fen().split(" ")[0]).toBe("4k3/8/8/8/8/8/8/1n2K3");
  });
});

describe("check (item 7)", () => {
  it("is detected", () => {
    const g = new Game("4k3/8/8/8/8/8/8/4K2R w - - 0 1");
    expect(g.status().check).toBe(false);
    playAll(g, ["h1h8"]);
    expect(g.status().check).toBe(true);
    expect(g.history[0].san).toBe("Rh8+");
  });
});

describe("checkmate and stalemate (item 8)", () => {
  it("fool's mate ends the game, black wins", () => {
    const g = new Game();
    playAll(g, ["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(g.status()).toMatchObject({ over: true, reason: "checkmate", winner: "b" });
    expect(g.history[3].san).toBe("Qh4#");
  });
  it("stalemate ends the game as a draw", () => {
    const g = new Game("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1");
    playAll(g, ["f1f7"]);
    expect(g.status()).toMatchObject({ over: true, reason: "stalemate" });
    expect(g.status().winner).toBeUndefined();
  });
  it("no more moves after the end", () => {
    const g = new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(g.status().reason).toBe("stalemate");
  });
});

describe("draws (item 9)", () => {
  it("threefold repetition", () => {
    const g = new Game();
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    playAll(g, shuffle);
    expect(g.status().over).toBe(false); // start position seen twice
    playAll(g, shuffle.slice(0, 3));
    expect(g.status().over).toBe(false);
    playAll(g, shuffle.slice(3));
    expect(g.status()).toMatchObject({ over: true, reason: "threefold" });
  });
  it("repetition needs the same castling rights", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    // King steps lose castling rights, so the first position never comes back.
    playAll(g, ["e1f1", "e8f8", "f1e1", "f8e8", "e1f1", "e8f8", "f1e1", "f8e8"]);
    expect(g.repetitions()).toBe(2);
    expect(g.status().over).toBe(false);
  });
  it("fifty-move rule", () => {
    const g = new Game("4k3/8/8/8/8/8/8/R3K3 w - - 99 80");
    expect(g.status().over).toBe(false);
    playAll(g, ["a1a2"]);
    expect(g.status()).toMatchObject({ over: true, reason: "fifty-move" });
  });
  it("a pawn move resets the fifty-move count", () => {
    const g = new Game("4k3/8/8/8/8/8/P7/R3K3 w - - 99 80");
    playAll(g, ["a2a3"]);
    expect(g.pos.halfmove).toBe(0);
    expect(g.status().over).toBe(false);
  });
  it("checkmate on the 100th half-move counts as mate", () => {
    const g = new Game("k7/8/1K6/8/8/8/8/7R w - - 99 80");
    playAll(g, ["h1h8"]);
    expect(g.status().reason).toBe("checkmate");
  });
});

describe("FEN validation", () => {
  it("rejects bad FENs", () => {
    expect(() => Position.fromFen("nonsense")).toThrow();
    expect(() => Position.fromFen("8/8/8/8/8/8/8/8 w - - 0 1")).toThrow();
    expect(() => Position.fromFen("4k3/8/8/8/8/8/8/4K2R x - - 0 1")).toThrow();
  });
});
