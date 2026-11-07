import { describe, expect, it } from "vitest";
import { Position, START_FEN, perft } from "../../src/chess.ts";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

describe("perft", () => {
  it.each([
    [1, 20],
    [2, 400],
    [3, 8902],
    [4, 197281],
  ])("start position depth %i = %i", (depth, nodes) => {
    expect(perft(Position.fromFen(START_FEN), depth)).toBe(nodes);
  });

  it.each([
    [1, 48],
    [2, 2039],
    [3, 97862],
  ])("Kiwipete depth %i = %i", (depth, nodes) => {
    expect(perft(Position.fromFen(KIWIPETE), depth)).toBe(nodes);
  });

  // Extra standard positions that stress en passant, promotion and pins.
  it("position 3 depth 4 = 43238", () => {
    expect(perft(Position.fromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 4)).toBe(43238);
  });
  it("position 4 depth 3 = 9467", () => {
    expect(perft(Position.fromFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3)).toBe(9467);
  });
  it("position 5 depth 3 = 62379", () => {
    expect(perft(Position.fromFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"), 3)).toBe(62379);
  });

  it("FEN round-trips", () => {
    expect(Position.fromFen(KIWIPETE).fen()).toBe(KIWIPETE);
    expect(Position.fromFen(START_FEN).fen()).toBe(START_FEN);
  });
});
