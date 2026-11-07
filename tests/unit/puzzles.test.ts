import { describe, expect, it } from "vitest";
import { Game } from "../../src/chess.ts";
import puzzles from "../../public/puzzles.json";

describe("puzzle data", () => {
  it("has 12 puzzles", () => expect(puzzles).toHaveLength(12));
  it.each(puzzles.map((p) => [p.id, p] as const))("puzzle %i solution is legal and mates", (_id, p) => {
    const g = new Game(p.fen);
    for (const uci of p.solution) {
      const m = g.findUci(uci);
      expect(m, uci).toBeDefined();
      g.play(m!);
    }
    expect(g.status().reason).toBe("checkmate");
    expect(p.solution.length).toBe(p.type === "mate-in-1" ? 1 : 3);
  });
});
