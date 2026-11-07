import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseUci } from "../../src/engine.ts";
import { Game } from "../../src/game.ts";

const puzzles: { id: number; type: string; fen: string; solution: string[] }[] = JSON.parse(
  readFileSync("public/puzzles.json", "utf8"),
);

describe("puzzles", () => {
  it("has 12", () => expect(puzzles).toHaveLength(12));
  it.each(puzzles.map((p) => [p.id, p] as const))("puzzle %i solution is legal and ends in mate", (_id, p) => {
    const g = new Game(p.fen);
    for (const m of p.solution) expect(g.play(parseUci(m))).toBe(true);
    expect(g.result).toMatchObject({ over: true, kind: "checkmate" });
    expect(p.solution.length).toBe(p.type === "mate-in-1" ? 1 : 3);
  });
});
