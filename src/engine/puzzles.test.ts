import { describe, expect, it } from "vitest";
import puzzles from "../../public/puzzles.json";
import { Game } from "./index.ts";

interface Puzzle {
  id: number;
  fen: string;
  solution: string[];
}

describe("public/puzzles.json", () => {
  it("has 12 puzzles", () => {
    expect(puzzles).toHaveLength(12);
  });

  for (const p of puzzles as Puzzle[]) {
    it(`puzzle ${p.id}: solution is legal and ends in checkmate`, () => {
      const g = new Game(p.fen);
      for (const uci of p.solution) {
        expect(g.moveUci(uci), `${uci} legal in ${g.fen()}`).not.toBeNull();
      }
      expect(g.status().state).toBe("checkmate");
    });
  }
});
