import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game, START_FEN } from '../../src/engine/index.ts';

function play(g: Game, ...ucis: string[]) {
  for (const u of ucis) {
    const m = g.move(u);
    if (!m) throw new Error(`illegal move ${u} in ${g.fen()}`);
  }
}
const ucis = (g: Game, from?: string) => g.moves(from).map((m) => m.uci);

describe('basics / legality', () => {
  it('starts with 20 moves and white to move', () => {
    const g = new Game();
    expect(g.moves()).toHaveLength(20);
    expect(g.turn()).toBe('w');
    expect(g.fen()).toBe(START_FEN);
    expect(g.get('e1')).toEqual({ colour: 'w', type: 'k' });
    expect(g.board()[0][0]).toEqual({ colour: 'b', type: 'r' });
    expect(g.kingSquare('b')).toBe('e8');
  });

  it('rejects illegal and malformed moves', () => {
    const g = new Game();
    expect(g.move('e2e5')).toBeNull();
    expect(g.move('e7e5')).toBeNull(); // wrong side
    expect(g.move('zz')).toBeNull();
    expect(g.move({ from: 'e2', to: 'e4', promotion: 'q' })).toBeNull();
    expect(g.move({ from: 'e2', to: 'e4' })?.san).toBe('e4');
    expect(g.history()).toHaveLength(1);
  });

  it('pinned pieces cannot move off the pin line', () => {
    const g = new Game('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(g.moves('e2')).toHaveLength(0);
  });

  it('undo restores the position', () => {
    const g = new Game();
    play(g, 'e2e4', 'e7e5', 'g1f3');
    expect(g.undo()?.uci).toBe('g1f3');
    play(g, 'g1f3');
    g.undo();
    g.undo();
    g.undo();
    expect(g.fen()).toBe(START_FEN);
    expect(g.undo()).toBeNull();
  });

  it('throws on invalid FEN', () => {
    expect(() => new Game('nonsense')).toThrow();
    expect(() => new Game('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow();
  });
});

describe('castling', () => {
  const base = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  it('is available on both sides and executes', () => {
    const g = new Game(base);
    expect(ucis(g, 'e1')).toEqual(expect.arrayContaining(['e1g1', 'e1c1']));
    const m = g.move('e1g1');
    expect(m?.san).toBe('O-O');
    expect(m?.flags.castle).toBe('k');
    expect(g.fen()).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1');
    const q = g.move('e8c8');
    expect(q?.san).toBe('O-O-O');
    expect(g.get('c8')?.type).toBe('k');
    expect(g.get('d8')?.type).toBe('r');
    expect(g.get('a8')).toBeNull();
  });

  it('white queenside castling executes', () => {
    const g = new Game(base);
    const m = g.move('e1c1');
    expect(m?.san).toBe('O-O-O');
    expect(g.get('d1')?.type).toBe('r');
    expect(g.get('c1')?.type).toBe('k');
  });

  it('is blocked by pieces between king and rook', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/R2QK1NR w KQkq - 0 1');
    expect(ucis(g)).not.toContain('e1g1');
    expect(ucis(g)).not.toContain('e1c1');
    const h = new Game('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1'); // b1 occupied
    expect(ucis(h)).not.toContain('e1c1');
    expect(ucis(h)).toContain('e1g1');
  });

  it('is illegal while in check', () => {
    const g = new Game('4r3/2k5/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(ucis(g)).not.toContain('e1g1');
    expect(ucis(g)).not.toContain('e1c1');
  });

  it('is illegal through check', () => {
    const g = new Game('5r2/2k5/8/8/8/8/8/R3K2R w KQ - 0 1'); // f1 attacked
    expect(ucis(g)).not.toContain('e1g1');
    expect(ucis(g)).toContain('e1c1');
    const h = new Game('3r4/2k5/8/8/8/8/8/R3K2R w KQ - 0 1'); // d1 attacked
    expect(ucis(h)).not.toContain('e1c1');
    expect(ucis(h)).toContain('e1g1');
  });

  it('is illegal into check', () => {
    const g = new Game('6r1/2k5/8/8/8/8/8/R3K2R w KQ - 0 1'); // g1 attacked
    expect(ucis(g)).not.toContain('e1g1');
    expect(ucis(g)).toContain('e1c1');
    const h = new Game('2r5/3k4/8/8/8/8/8/R3K2R w KQ - 0 1'); // c1 attacked
    expect(ucis(h)).not.toContain('e1c1');
  });

  it('is allowed when only b1 is attacked', () => {
    const g = new Game('1r6/2k5/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(ucis(g)).toContain('e1c1');
  });

  it('is lost once the king has moved', () => {
    const g = new Game(base);
    play(g, 'e1e2', 'e8e7', 'e2e1', 'e7e8');
    expect(ucis(g, 'e1')).not.toContain('e1g1');
    expect(ucis(g, 'e1')).not.toContain('e1c1');
  });

  it('is lost on one side once that rook has moved', () => {
    const g = new Game(base);
    play(g, 'h1g1', 'a8b8', 'g1h1', 'b8a8');
    expect(ucis(g, 'e1')).not.toContain('e1g1');
    expect(ucis(g, 'e1')).toContain('e1c1');
    const h = new Game(base);
    play(h, 'a1b1', 'a8b8', 'b1a1', 'b8a8');
    expect(ucis(h, 'e1')).toContain('e1g1');
    expect(ucis(h, 'e1')).not.toContain('e1c1');
  });

  it('is lost when the rook is captured', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
    play(g, 'h8h1');
    expect(g.fen().split(' ')[2]).toBe('Qq');
    expect(ucis(g)).not.toContain('e1g1');
  });
});

describe('en passant', () => {
  it('is available right after the double step and captures the pawn', () => {
    const g = new Game();
    play(g, 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    const ep = g.moves('e5').find((m) => m.flags.enPassant);
    expect(ep?.uci).toBe('e5d6');
    expect(ep?.san).toBe('exd6');
    expect(ep?.captured).toBe('p');
    g.move('e5d6');
    expect(g.get('d5')).toBeNull();
    expect(g.get('d6')).toEqual({ colour: 'w', type: 'p' });
    g.undo();
    expect(g.get('d5')).toEqual({ colour: 'b', type: 'p' });
    expect(g.get('e5')).toEqual({ colour: 'w', type: 'p' });
  });

  it('expires if not played immediately', () => {
    const g = new Game();
    play(g, 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'h7h6');
    expect(g.moves('e5').some((m) => m.flags.enPassant)).toBe(false);
    expect(g.move('e5d6')).toBeNull();
  });

  it('is not flagged for a single-step pawn (plain capture instead)', () => {
    const g = new Game();
    play(g, 'e2e4', 'a7a6', 'e4e5', 'd7d6');
    expect(g.moves('e5').some((m) => m.flags.enPassant)).toBe(false);
    expect(g.move('e5d6')?.flags.enPassant).toBeUndefined();
  });

  it('is illegal if it exposes the king', () => {
    // white king a5, black rook h5; capturing en passant removes both pawns from rank 5
    const g = new Game('7k/8/8/K2pP2r/8/8/8/8 w - d6 0 1');
    expect(ucis(g, 'e5')).not.toContain('e5d6');
  });
});

describe('promotion', () => {
  const fen = '7k/P7/8/8/8/8/8/K7 w - - 0 1';
  it('offers queen, rook, bishop and knight', () => {
    const g = new Game(fen);
    const promos = g.moves('a7').map((m) => m.promotion);
    expect(promos.sort()).toEqual(['b', 'n', 'q', 'r']);
  });

  it.each(['q', 'r', 'b', 'n'] as const)('promotes to %s', (p) => {
    const g = new Game(fen);
    const m = g.move({ from: 'a7', to: 'a8', promotion: p });
    expect(m?.promotion).toBe(p);
    expect(m?.uci).toBe(`a7a8${p}`);
    expect(g.get('a8')).toEqual({ colour: 'w', type: p });
    g.undo();
    expect(g.get('a7')).toEqual({ colour: 'w', type: 'p' });
  });

  it('works via UCI string and requires a piece', () => {
    const g = new Game(fen);
    expect(g.move('a7a8')).toBeNull();
    expect(g.move({ from: 'a7', to: 'a8' })).toBeNull();
    expect(g.move({ from: 'a7', to: 'a8', promotion: 'p' as never })).toBeNull();
    expect(g.move('a7a8n')?.san).toBe('a8=N');
  });

  it('promotes with capture', () => {
    const g = new Game('1n5k/P7/8/8/8/8/8/K7 w - - 0 1');
    expect(g.move('a7b8q')?.captured).toBe('n');
  });
});

describe('check, checkmate, stalemate', () => {
  it('detects check and restricts replies', () => {
    const g = new Game('4k3/8/8/8/8/8/8/4RK2 b - - 0 1');
    expect(g.inCheck()).toBe(true);
    expect(g.status()).toEqual({ state: 'playing', check: true });
    expect(ucis(g)).not.toContain('e8e7');
    expect(ucis(g).sort()).toEqual(['e8d7', 'e8d8', 'e8f7', 'e8f8']);
  });

  it('no check at start', () => {
    const g = new Game();
    expect(g.inCheck()).toBe(false);
    expect(g.status()).toEqual({ state: 'playing', check: false });
    expect(g.isGameOver()).toBe(false);
  });

  it("fool's mate is checkmate", () => {
    const g = new Game();
    play(g, 'f2f3', 'e7e5', 'g2g4');
    const m = g.move('d8h4');
    expect(m?.san).toBe('Qh4#');
    expect(g.status()).toEqual({ state: 'checkmate', winner: 'b' });
    expect(g.isGameOver()).toBe(true);
    expect(g.moves()).toHaveLength(0);
    expect(g.move('a2a3')).toBeNull();
  });

  it('detects stalemate', () => {
    const g = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.inCheck()).toBe(false);
    expect(g.status()).toEqual({ state: 'stalemate' });
    expect(g.isGameOver()).toBe(true);
  });

  it('check is reported after a checking move', () => {
    const g = new Game();
    play(g, 'e2e4', 'f7f6', 'd1h5');
    expect(g.history()[2].san).toBe('Qh5+');
    expect(g.status()).toEqual({ state: 'playing', check: true });
  });
});

describe('draws', () => {
  it('threefold repetition', () => {
    const g = new Game();
    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(g.status().state).toBe('playing'); // 2nd occurrence
    play(g, 'g1f3', 'g8f6', 'f3g1');
    expect(g.status().state).toBe('playing');
    play(g, 'f6g8');
    expect(g.status()).toEqual({ state: 'draw', reason: 'threefold' });
    expect(g.isGameOver()).toBe(true);
    g.undo();
    expect(g.status().state).toBe('playing');
  });

  it('repetition requires the same castling rights', () => {
    const g = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    // rooks shuffle: first and later occurrences differ in rights, so no draw yet
    play(g, 'h1g1', 'h8g8', 'g1h1', 'g8h8', 'h1g1', 'h8g8', 'g1h1', 'g8h8');
    expect(g.status().state).toBe('playing');
  });

  it('fifty-move rule at halfmove clock 100', () => {
    const g = new Game('4k3/8/8/8/8/8/8/R3K3 w - - 98 80');
    play(g, 'a1a2');
    expect(g.status()).toEqual({ state: 'playing', check: false });
    play(g, 'e8d8');
    expect(g.status()).toEqual({ state: 'draw', reason: 'fifty-move' });
  });

  it('a pawn move or capture resets the clock', () => {
    const g = new Game('4k3/8/8/8/8/8/P7/4K3 w - - 99 80');
    play(g, 'a2a3');
    expect(g.status().state).toBe('playing');
  });

  it('checkmate takes precedence over fifty-move', () => {
    const g = new Game('7k/5K2/8/8/8/8/8/6R1 w - - 99 80');
    g.move('g1h1');
    expect(g.status()).toEqual({ state: 'checkmate', winner: 'w' });
  });
});

describe('SAN / UCI', () => {
  it('basic moves and captures', () => {
    const g = new Game();
    play(g, 'e2e4', 'd7d5', 'e4d5', 'g8f6', 'g1f3');
    expect(g.history().map((m) => m.san)).toEqual(['e4', 'd5', 'exd5', 'Nf6', 'Nf3']);
    expect(g.history()[2].uci).toBe('e4d5');
  });

  it('piece captures use x', () => {
    const g = new Game('4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1');
    expect(g.move('c3d5')?.san).toBe('Nxd5');
  });

  it('disambiguates by file', () => {
    const g = new Game('8/2k5/8/8/8/8/4K3/R6R w - - 0 1');
    const sans = g.moves().filter((m) => m.to === 'd1' && m.piece === 'r').map((m) => m.san);
    expect(sans.sort()).toEqual(['Rad1', 'Rhd1']);
  });

  it('disambiguates by rank', () => {
    const g = new Game('7k/8/8/R7/8/8/8/R3K3 w - - 0 1');
    const sans = g.moves().filter((m) => m.to === 'a3').map((m) => m.san);
    expect(sans.sort()).toEqual(['R1a3', 'R5a3']);
  });

  it('disambiguates by file and rank', () => {
    const g = new Game('8/8/8/8/7k/2Q5/8/Q1Q1K3 w - - 0 1');
    const sans = g.moves().filter((m) => m.to === 'a3' && m.piece === 'q').map((m) => m.san);
    expect(sans).toContain('Qc1a3');
    expect(sans).toContain('Qaa3');
    expect(sans).toContain('Q3a3');
  });

  it('promotion and check suffixes', () => {
    const g = new Game('k7/4P3/8/8/8/8/8/K7 w - - 0 1');
    const m = g.move('e7e8q');
    expect(m?.san).toBe('e8=Q+');
    expect(m?.uci).toBe('e7e8q');
  });

  it('promotion with capture and mate', () => {
    const g = new Game('r6k/1P6/6K1/8/8/8/8/8 w - - 0 1');
    expect(g.move('b7a8q')?.san).toBe('bxa8=Q#');
  });

  it('castling SAN with check', () => {
    const g = new Game('5k2/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(g.move('e1g1')?.san).toBe('O-O+');
  });

  it('flags', () => {
    const g = new Game();
    expect(g.move('e2e4')?.flags.doublePush).toBe(true);
    expect(g.move('e7e6')?.flags.doublePush).toBeUndefined();
  });
});

describe('puzzles', () => {
  const puzzles = JSON.parse(readFileSync('public/puzzles.json', 'utf8')) as {
    id: number;
    type: string;
    fen: string;
    solution: string[];
  }[];

  it('has puzzles', () => {
    expect(puzzles.length).toBeGreaterThan(0);
  });

  it.each(puzzles.map((p) => [p.id, p] as const))('puzzle %s plays legally and ends in checkmate', (_id, p) => {
    const g = new Game(p.fen);
    for (const u of p.solution) {
      expect(g.move(u), `${u} in ${g.fen()}`).not.toBeNull();
    }
    expect(g.status().state).toBe('checkmate');
    expect(g.history().at(-1)?.san.endsWith('#')).toBe(true);
  });
});
