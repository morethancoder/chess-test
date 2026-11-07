import { describe, expect, it } from "vitest";
import {
  START_FEN, inCheck, legalMoves, newGame, parseFen, perft, play, sqIndex, toFen, uci,
  type Game, type Promo,
} from "../../src/engine.ts";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

function mv(g: Game, u: string): Game {
  const next = play(g, {
    from: sqIndex(u.slice(0, 2)),
    to: sqIndex(u.slice(2, 4)),
    promo: (u[4] as Promo | undefined),
  });
  if (!next) throw new Error(`illegal move ${u} in ${toFen(g.position)}`);
  return next;
}
const run = (g: Game, ...moves: string[]) => moves.reduce(mv, g);
const ucis = (fen: string) => legalMoves(parseFen(fen)).map(uci);

describe("perft", () => {
  const start = parseFen(START_FEN);
  it("start position", () => {
    expect([1, 2, 3, 4].map((d) => perft(start, d))).toEqual([20, 400, 8902, 197281]);
  });
  it("kiwipete", () => {
    const k = parseFen(KIWIPETE);
    expect([1, 2, 3].map((d) => perft(k, d))).toEqual([48, 2039, 97862]);
  });
});

describe("legal moves", () => {
  it("rejects moves that leave the king in check and pieces moving illegally", () => {
    const g = newGame();
    expect(play(g, { from: sqIndex("e2"), to: sqIndex("e5") })).toBeNull();
    expect(ucis("4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1").some((m) => m.startsWith("e2"))).toBe(false);
  });
});

describe("castling", () => {
  it("is offered on both sides when legal", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(m).toContain("e1g1");
    expect(m).toContain("e1c1");
  });
  it("moves the rook too", () => {
    const g = mv(newGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), "e1g1");
    expect(toFen(g.position).split(" ")[0]).toBe("r3k2r/8/8/8/8/8/8/R4RK1");
    const q = mv(newGame("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"), "e8c8");
    expect(toFen(q.position).split(" ")[0]).toBe("2kr3r/8/8/8/8/8/8/R3K2R");
  });
  it("is not allowed with pieces in between", () => {
    const m = ucis("r3k2r/8/8/8/8/8/8/RN2K1NR w KQkq - 0 1");
    expect(m).not.toContain("e1g1");
    expect(m).not.toContain("e1c1");
  });
  it("is not allowed out of, through or into check", () => {
    expect(ucis("r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1")).not.toContain("e1g1"); // in check
    expect(ucis("r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1")).not.toContain("e1g1"); // through f1? f2 rook attacks f1
    expect(ucis("r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1")).not.toContain("e1g1"); // into g1
    expect(ucis("r3k2r/8/8/8/8/8/3r4/R3K2R w KQkq - 0 1")).not.toContain("e1c1"); // through d1
    // b1 attacked is fine for queen side
    expect(ucis("r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1")).toContain("e1c1");
  });
  it("is lost after the king or rook has moved", () => {
    let g = run(newGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), "h1h2", "a8a7", "h2h1", "a7a8");
    const m = legalMoves(g.position).map(uci);
    expect(m).toContain("e1c1");
    expect(m).not.toContain("e1g1");
    g = run(g, "e1d1", "e8d8", "d1e1", "d8e8");
    expect(legalMoves(g.position).map(uci)).not.toContain("e1c1");
  });
});

describe("en passant", () => {
  it("is available right after the double step", () => {
    const g = run(newGame("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1"), "d7d5");
    expect(legalMoves(g.position).map(uci)).toContain("e5d6");
    const after = mv(g, "e5d6");
    expect(after.position.board[sqIndex("d5")]).toBeNull();
    expect(after.position.board[sqIndex("d6")]).toBe("wP");
  });
  it("expires one move later", () => {
    const g = run(newGame("4k3/3p4/8/4P3/8/8/7P/4K3 b - - 0 1"), "d7d5", "h2h3", "e8e7");
    expect(legalMoves(g.position).map(uci)).not.toContain("e5d6");
  });
  it("is not available after a single-step pawn move", () => {
    const g = run(newGame("4k3/3p4/8/8/4P3/8/8/4K3 b - - 0 1"), "d7d6", "e4e5");
    expect(legalMoves(g.position).map(uci)).not.toContain("e5d6");
    expect(g.position.ep).toBe(-1);
  });
});

describe("promotion", () => {
  it("offers all four pieces and applies the choice", () => {
    const fen = "7k/4P3/8/8/8/8/8/K7 w - - 0 1";
    expect(ucis(fen).filter((m) => m.startsWith("e7e8")).sort()).toEqual(["e7e8b", "e7e8n", "e7e8q", "e7e8r"]);
    for (const p of ["q", "r", "b", "n"]) {
      const g = mv(newGame(fen), "e7e8" + p);
      expect(g.position.board[sqIndex("e8")]).toBe("w" + p.toUpperCase());
    }
  });
  it("rejects a promotion move without a piece", () => {
    expect(play(newGame("7k/4P3/8/8/8/8/8/K7 w - - 0 1"), { from: sqIndex("e7"), to: sqIndex("e8") })).toBeNull();
  });
});

describe("check", () => {
  it("is detected and must be answered", () => {
    const g = run(newGame(), "e2e4", "f7f6", "d1h5");
    expect(inCheck(g.position)).toBe(true);
    expect(legalMoves(g.position).map(uci).sort()).toEqual(["g7g6"]);
  });
});

describe("game end", () => {
  it("detects checkmate (fool's mate)", () => {
    const g = run(newGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(g.result).toEqual({ kind: "checkmate", winner: "b" });
    expect(play(g, { from: sqIndex("a2"), to: sqIndex("a3") })).toBeNull();
  });
  it("detects stalemate", () => {
    const g = newGame("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(g.result).toEqual({ kind: "stalemate" });
    const h = mv(newGame("7k/8/5K2/6Q1/8/8/8/8 w - - 0 1"), "g5g6");
    expect(h.result).toEqual({ kind: "stalemate" });
  });
  it("draws on threefold repetition", () => {
    let g = newGame();
    g = run(g, "g1f3", "g8f6", "f3g1", "f6g8");
    expect(g.result).toBeNull();
    g = run(g, "g1f3", "g8f6", "f3g1", "f6g8");
    expect(g.result).toEqual({ kind: "threefold" });
  });
  it("does not count a position twice as a draw", () => {
    const g = run(newGame(), "g1f3", "g8f6", "f3g1", "f6g8");
    expect(g.result).toBeNull();
  });
  it("draws by the 50-move rule", () => {
    const g = newGame("4k3/8/8/8/8/8/R7/4K3 w - - 99 80");
    expect(g.result).toBeNull();
    const h = mv(g, "a2a3");
    expect(h.result).toEqual({ kind: "fifty" });
  });
  it("a capture or pawn move resets the 50-move counter", () => {
    const g = mv(newGame("4k3/8/8/8/8/8/P7/4K3 w - - 99 80"), "a2a3");
    expect(g.position.halfmove).toBe(0);
    expect(g.result).toBeNull();
  });
  it("checkmate on the 100th half-move still counts as mate", () => {
    const g = mv(newGame("7k/8/6K1/8/8/8/8/R7 w - - 99 80"), "a1a8");
    expect(g.result).toEqual({ kind: "checkmate", winner: "w" });
  });
});
