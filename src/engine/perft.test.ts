import { describe, expect, it } from "vitest";
import { Game, START_FEN, perft } from "./index.ts";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const POS3 = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
const POS4 = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
const POS5 = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";

const cases: [string, string, number[]][] = [
  ["start", START_FEN, [20, 400, 8902, 197281]],
  ["kiwipete", KIWIPETE, [48, 2039, 97862]],
  ["position 3", POS3, [14, 191, 2812, 43238]],
  ["position 4", POS4, [6, 264, 9467]],
  ["position 5", POS5, [44, 1486, 62379]],
];

describe("perft", () => {
  for (const [name, fen, counts] of cases) {
    counts.forEach((expected, i) => {
      it(`${name} depth ${i + 1} = ${expected}`, () => {
        expect(perft(new Game(fen), i + 1)).toBe(expected);
      }, 30000);
    });
  }

  it("depth 0 is 1", () => {
    expect(perft(new Game(), 0)).toBe(1);
  });
});
