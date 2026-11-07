import { describe, expect, it } from 'vitest';
import { START_FEN, perft } from '../../src/engine/index.ts';

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

describe('perft', () => {
  it.each([
    [1, 20],
    [2, 400],
    [3, 8902],
    [4, 197281],
  ])('start position depth %i = %i', (d, n) => {
    expect(perft(START_FEN, d)).toBe(n);
  });

  it.each([
    [1, 48],
    [2, 2039],
    [3, 97862],
  ])('kiwipete depth %i = %i', (d, n) => {
    expect(perft(KIWIPETE, d)).toBe(n);
  });
});
