import { describe, expect, it } from "vitest";
import { Game, START_FEN, isValidFen } from "./index.ts";

function play(g: Game, ...ucis: string[]): void {
  for (const u of ucis) {
    if (!g.moveUci(u)) throw new Error(`illegal test move ${u} in ${g.fen()}`);
  }
}

function targets(g: Game, from: string): string[] {
  return g.legalMoves(from).map((m) => m.to).sort();
}

describe("basics", () => {
  it("start position", () => {
    const g = new Game();
    expect(g.fen()).toBe(START_FEN);
    expect(g.turn()).toBe("w");
    expect(g.legalMoves()).toHaveLength(20);
    expect(g.get("e1")).toEqual({ color: "w", type: "k" });
    expect(g.board()[0][0]).toEqual({ color: "b", type: "r" });
    expect(g.board()[7][4]).toEqual({ color: "w", type: "k" });
    expect(g.kingSquare("b")).toBe("e8");
    expect(g.status()).toEqual({ state: "playing", check: false });
  });

  it("rejects illegal moves", () => {
    const g = new Game();
    expect(g.move({ from: "e2", to: "e5" })).toBeNull();
    expect(g.move({ from: "e7", to: "e5" })).toBeNull(); // wrong side
    expect(g.move({ from: "e3", to: "e4" })).toBeNull(); // empty square
    expect(g.move({ from: "z9", to: "e4" })).toBeNull();
    expect(g.moveUci("garbage")).toBeNull();
    expect(g.fen()).toBe(START_FEN);
  });

  it("pinned piece cannot move; king cannot step into check", () => {
    const g = new Game("4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(g.legalMoves("e2")).toHaveLength(0);
    const h = new Game("4k3/8/8/8/8/8/r7/4K3 w - - 0 1");
    expect(targets(h, "e1")).toEqual(["d1", "e2", "f1", "f2"].filter((s) => s[1] !== "2"));
  });

  it("must resolve check", () => {
    const g = new Game("4k3/8/8/8/8/8/4r3/R3K3 w - - 0 1");
    // Ke1 is attacked by Re2: capture it with the king or the rook cannot help
    expect(g.inCheck()).toBe(true);
    expect(g.legalMoves().every((m) => m.piece === "k")).toBe(true);
    expect(g.move({ from: "a1", to: "a2" })).toBeNull();
  });

  it("undo restores the position and history", () => {
    const g = new Game();
    play(g, "e2e4", "e7e5", "g1f3");
    expect(g.history().map((m) => m.san)).toEqual(["e4", "e5", "Nf3"]);
    expect(g.lastMove()?.to).toBe("f3");
    g.undo();
    g.undo();
    g.undo();
    expect(g.fen()).toBe(START_FEN);
    expect(g.undo()).toBeNull();
    expect(g.lastMove()).toBeNull();
  });

  it("validates FEN", () => {
    expect(isValidFen(START_FEN)).toBe(true);
    expect(isValidFen("nonsense")).toBe(false);
    expect(isValidFen("8/8/8/8/8/8/8/8 w - - 0 1")).toBe(false);
    expect(isValidFen("4k3/8/8/8/8/8/8/4K2 w - - 0 1")).toBe(false);
    expect(isValidFen("4k3/8/8/8/8/8/8/4K3 x - - 0 1")).toBe(false);
    expect(isValidFen("P3k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(false);
    expect(isValidFen("4k3/8/8/8/8/8/4R3/4K3 w - - 0 1")).toBe(false); // side to move can capture king
    expect(() => new Game("bad")).toThrow(Error);
  });

  it("fen round-trips", () => {
    const g = new Game();
    play(g, "e2e4");
    expect(g.fen()).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  });
});

describe("castling", () => {
  const base = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

  it("works on both sides for white and black", () => {
    const g = new Game(base);
    const k = g.move({ from: "e1", to: "g1" });
    expect(k?.flags.castle).toBe("k");
    expect(k?.san).toBe("O-O");
    expect(g.get("g1")?.type).toBe("k");
    expect(g.get("f1")?.type).toBe("r");
    expect(g.get("h1")).toBeNull();
    const q = g.move({ from: "e8", to: "c8" });
    expect(q?.flags.castle).toBe("q");
    expect(q?.san).toBe("O-O-O");
    expect(g.get("c8")?.type).toBe("k");
    expect(g.get("d8")?.type).toBe("r");
    expect(g.get("a8")).toBeNull();
    g.undo();
    g.undo();
    expect(g.fen()).toBe(base);
    const h = new Game(base);
    expect(h.move({ from: "e1", to: "c1" })?.flags.castle).toBe("q");
    expect(h.get("d1")?.type).toBe("r");
    expect(h.move({ from: "e8", to: "g8" })?.flags.castle).toBe("k");
    expect(h.get("f8")?.type).toBe("r");
  });

  it("is refused without the castling right", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w Kkq - 0 1");
    expect(targets(g, "e1")).toContain("g1");
    expect(targets(g, "e1")).not.toContain("c1");
  });

  it("is refused after the rook moved and came back", () => {
    const g = new Game(base);
    play(g, "h1h2", "a8a7", "h2h1", "a7a8");
    expect(targets(g, "e1")).not.toContain("g1");
    expect(targets(g, "e1")).toContain("c1");
  });

  it("is refused after the king moved and came back", () => {
    const g = new Game(base);
    play(g, "e1e2", "a8a7", "e2e1", "a7a8");
    expect(targets(g, "e1")).not.toContain("g1");
    expect(targets(g, "e1")).not.toContain("c1");
  });

  it("is refused after the rook was captured", () => {
    const g = new Game("r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1");
    play(g, "g2h1");
    expect(targets(g, "e1")).not.toContain("g1");
  });

  it("is refused when squares between are occupied", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1");
    expect(targets(g, "e1")).toContain("g1");
    expect(targets(g, "e1")).not.toContain("c1");
    const h = new Game("r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1");
    expect(targets(h, "e1")).not.toContain("g1");
    expect(targets(h, "e1")).toContain("c1");
  });

  it("is refused while in check", () => {
    const g = new Game("r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1");
    expect(g.inCheck()).toBe(true);
    expect(targets(g, "e1")).not.toContain("g1");
    expect(targets(g, "e1")).not.toContain("c1");
  });

  it("is refused through an attacked square", () => {
    const k = new Game("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(targets(k, "e1")).not.toContain("g1");
    expect(targets(k, "e1")).toContain("c1");
    const q = new Game("3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(targets(q, "e1")).toContain("g1");
    expect(targets(q, "e1")).not.toContain("c1");
  });

  it("is refused into check", () => {
    const k = new Game("4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(targets(k, "e1")).not.toContain("g1");
    const q = new Game("2r1k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(targets(q, "e1")).not.toContain("c1");
  });

  it("is allowed when only the rook's neighbour b1 is attacked", () => {
    const g = new Game("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(targets(g, "e1")).toContain("c1");
  });
});

describe("en passant", () => {
  it("white captures en passant right after the double step", () => {
    const g = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
    const dp = g.move({ from: "d7", to: "d5" });
    expect(dp?.flags.doublePush).toBe(true);
    const ep = g.legalMoves("e5").find((m) => m.to === "d6");
    expect(ep?.flags.enPassant).toBe(true);
    expect(ep?.captured).toBe("p");
    g.move({ from: "e5", to: "d6" });
    expect(g.get("d5")).toBeNull();
    expect(g.get("d6")).toEqual({ color: "w", type: "p" });
    g.undo();
    expect(g.get("d5")).toEqual({ color: "b", type: "p" });
    expect(g.get("d6")).toBeNull();
  });

  it("black captures en passant", () => {
    const g = new Game("4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1");
    play(g, "e2e4");
    expect(g.fen()).toContain(" e3 ");
    const m = g.move({ from: "d4", to: "e3" });
    expect(m?.flags.enPassant).toBe(true);
    expect(g.get("e4")).toBeNull();
  });

  it("expires if not taken immediately", () => {
    const g = new Game("4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1");
    play(g, "e2e4", "e8e7", "e1d1", "e7e8", "d1e1");
    expect(g.move({ from: "d4", to: "e3" })).toBeNull();
    expect(g.legalMoves("d4").map((m) => m.to)).toEqual(["d3"]);
  });

  it("is not available for a single step or without a pawn beside", () => {
    const g = new Game("4k3/8/8/8/3p4/4P3/8/4K3 w - - 0 1");
    play(g, "e3e4");
    expect(g.move({ from: "d4", to: "e3" })).toBeNull();
  });

  it("is illegal when it exposes the king", () => {
    // white king a5, pawn b5, black pawn c7->c5, black rook h5: b5xc6 would expose the king on rank 5
    const g = new Game("4k3/2p5/8/KP5r/8/8/8/8 b - - 0 1");
    play(g, "c7c5");
    expect(g.legalMoves("b5").map((m) => m.to)).toEqual(["b6"]);
  });
});

describe("promotion", () => {
  it("lists one move per promotion piece", () => {
    const g = new Game("7k/P7/8/8/8/8/8/K7 w - - 0 1");
    const ms = g.legalMoves("a7");
    expect(ms.map((m) => m.promotion).sort()).toEqual(["b", "n", "q", "r"]);
    expect(ms.every((m) => m.to === "a8")).toBe(true);
  });

  it("requires a promotion piece", () => {
    const g = new Game("7k/P7/8/8/8/8/8/K7 w - - 0 1");
    expect(g.move({ from: "a7", to: "a8" })).toBeNull();
    expect(g.move({ from: "a7", to: "a8", promotion: "q" })).not.toBeNull();
  });

  for (const p of ["q", "r", "b", "n"] as const) {
    it(`promotes to ${p}`, () => {
      const g = new Game("7k/P7/8/8/8/8/8/K7 w - - 0 1");
      const m = g.move({ from: "a7", to: "a8", promotion: p });
      expect(m?.promotion).toBe(p);
      expect(g.get("a8")).toEqual({ color: "w", type: p });
      expect(g.get("a7")).toBeNull();
      g.undo();
      expect(g.get("a7")).toEqual({ color: "w", type: "p" });
      expect(g.get("a8")).toBeNull();
    });
  }

  it("promotes by capture and for black", () => {
    const g = new Game("1n2k3/P7/8/8/8/8/p7/1N2K3 w - - 0 1");
    expect(g.legalMoves("a7").filter((m) => m.to === "b8")).toHaveLength(4);
    const m = g.moveUci("a7b8n");
    expect(m?.captured).toBe("n");
    expect(m?.san).toBe("axb8=N");
    const b = g.moveUci("a2a1r");
    expect(g.get("a1")).toEqual({ color: "b", type: "r" });
    expect(b?.promotion).toBe("r");
  });

  it("rejects invalid promotion on non-promoting moves", () => {
    const g = new Game();
    expect(g.move({ from: "e2", to: "e4", promotion: "q" })).toBeNull();
  });
});

describe("check, checkmate, stalemate", () => {
  it("detects check", () => {
    const g = new Game("4k3/8/8/8/8/8/4R3/4K3 b - - 0 1");
    expect(g.inCheck()).toBe(true);
    expect(g.status()).toEqual({ state: "playing", check: true });
    expect(g.isGameOver()).toBe(false);
    const san = new Game();
    play(san, "e2e4", "f7f5");
    expect(san.move({ from: "d1", to: "h5" })?.san).toBe("Qh5+");
  });

  it("detects checkmate (fool's mate)", () => {
    const g = new Game();
    play(g, "f2f3", "e7e5", "g2g4");
    const m = g.moveUci("d8h4");
    expect(m?.san).toBe("Qh4#");
    expect(g.status()).toEqual({ state: "checkmate", winner: "b" });
    expect(g.isGameOver()).toBe(true);
    expect(g.legalMoves()).toHaveLength(0);
    g.undo();
    expect(g.isGameOver()).toBe(false);
  });

  it("detects stalemate", () => {
    const g = new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(g.inCheck()).toBe(false);
    expect(g.status()).toEqual({ state: "stalemate" });
    expect(g.isGameOver()).toBe(true);
  });
});

describe("draws", () => {
  it("threefold repetition ends the game", () => {
    const g = new Game();
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    play(g, ...cycle);
    expect(g.status().state).toBe("playing");
    play(g, ...cycle.slice(0, 3));
    expect(g.status().state).toBe("playing");
    play(g, cycle[3]);
    expect(g.status()).toEqual({ state: "draw", reason: "threefold" });
    expect(g.isGameOver()).toBe(true);
    g.undo();
    expect(g.status().state).toBe("playing");
  });

  it("repetition does not count positions with different castling rights", () => {
    const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    play(g, "h1h2", "h8h7", "h2h1", "h7h8", "h1h2", "h8h7", "h2h1", "h7h8");
    expect(g.status()).toEqual({ state: "playing", check: false });
  });

  it("fifty-move rule at halfmove clock 100", () => {
    const g = new Game("4k3/8/8/8/8/8/8/R3K3 w - - 99 80");
    expect(g.status().state).toBe("playing");
    g.moveUci("a1a2");
    expect(g.status()).toEqual({ state: "draw", reason: "fifty-move" });
    expect(g.isGameOver()).toBe(true);
    expect(new Game("4k3/8/8/8/8/8/8/R3K3 w - - 100 80").status()).toEqual({ state: "draw", reason: "fifty-move" });
  });

  it("pawn moves and captures reset the clock", () => {
    const g = new Game("4k3/p7/8/8/8/8/P7/R3K3 w - - 99 80");
    g.moveUci("a2a3");
    expect(g.status().state).toBe("playing");
    expect(g.fen()).toContain(" 0 80");
  });

  it("checkmate takes priority over the fifty-move rule", () => {
    const g = new Game("6k1/5ppp/8/8/8/8/8/R3K3 w - - 99 80");
    g.moveUci("a1a8");
    expect(g.status()).toEqual({ state: "checkmate", winner: "w" });
  });
});
