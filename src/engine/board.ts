import type { Colour, Piece, PieceType, Position, Square } from './types.ts';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const TYPE_LETTERS = ' pnbrqk';

export function sqToIdx(sq: Square): number {
  if (!/^[a-h][1-8]$/.test(sq)) return -1;
  return (8 - (sq.charCodeAt(1) - 48)) * 8 + (sq.charCodeAt(0) - 97);
}

export function idxToSq(i: number): Square {
  return String.fromCharCode(97 + (i & 7)) + String(8 - (i >> 3));
}

export function codeToPiece(code: number): Piece | null {
  if (code === 0) return null;
  const colour: Colour = code > 0 ? 'w' : 'b';
  return { colour, type: TYPE_LETTERS[Math.abs(code)] as PieceType };
}

export function parseFen(fen: string): Position {
  if (typeof fen !== 'string') throw new Error('Invalid FEN');
  const f = fen.trim().split(/\s+/);
  if (f.length < 4 || f.length > 6) throw new Error(`Invalid FEN: ${fen}`);
  const rows = f[0].split('/');
  if (rows.length !== 8) throw new Error('Invalid FEN: need 8 ranks');
  const board = new Int8Array(64);
  const kings: [number, number] = [-1, -1];
  const kingCount = [0, 0];
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        file += ch.charCodeAt(0) - 48;
        continue;
      }
      const t = TYPE_LETTERS.indexOf(ch.toLowerCase());
      if (t < 1 || file > 7) throw new Error(`Invalid FEN piece placement: ${f[0]}`);
      if (t === 1 && (r === 0 || r === 7)) throw new Error('Invalid FEN: pawn on back rank');
      const white = ch === ch.toUpperCase();
      board[r * 8 + file] = white ? t : -t;
      if (t === 6) {
        kings[white ? 0 : 1] = r * 8 + file;
        kingCount[white ? 0 : 1]++;
      }
      file++;
    }
    if (file !== 8) throw new Error(`Invalid FEN rank: ${rows[r]}`);
  }
  if (kingCount[0] !== 1 || kingCount[1] !== 1) throw new Error('Invalid FEN: need one king per side');
  if (f[1] !== 'w' && f[1] !== 'b') throw new Error('Invalid FEN: side to move');
  if (!/^(-|[KQkq]+)$/.test(f[2])) throw new Error('Invalid FEN: castling');
  let castling = 0;
  if (f[2].includes('K')) castling |= 1;
  if (f[2].includes('Q')) castling |= 2;
  if (f[2].includes('k')) castling |= 4;
  if (f[2].includes('q')) castling |= 8;
  // drop rights that are impossible given the piece placement
  if (board[60] !== 6) castling &= ~3;
  if (board[63] !== 4) castling &= ~1;
  if (board[56] !== 4) castling &= ~2;
  if (board[4] !== -6) castling &= ~12;
  if (board[7] !== -4) castling &= ~4;
  if (board[0] !== -4) castling &= ~8;
  let ep = -1;
  if (f[3] !== '-') {
    if (!/^[a-h][36]$/.test(f[3])) throw new Error('Invalid FEN: en passant');
    ep = sqToIdx(f[3]);
  }
  const halfmove = f[4] === undefined ? 0 : Number(f[4]);
  const fullmove = f[5] === undefined ? 1 : Number(f[5]);
  if (!Number.isInteger(halfmove) || halfmove < 0 || !Number.isInteger(fullmove) || fullmove < 1) {
    throw new Error('Invalid FEN: move counters');
  }
  return { board, turn: f[1] === 'w' ? 1 : -1, castling, ep, halfmove, fullmove, kings };
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const v = pos.board[r * 8 + c];
      if (v === 0) {
        empty++;
        continue;
      }
      if (empty) s += empty;
      empty = 0;
      const ch = TYPE_LETTERS[Math.abs(v)];
      s += v > 0 ? ch.toUpperCase() : ch;
    }
    if (empty) s += empty;
    rows.push(s);
  }
  const c =
    (pos.castling & 1 ? 'K' : '') +
    (pos.castling & 2 ? 'Q' : '') +
    (pos.castling & 4 ? 'k' : '') +
    (pos.castling & 8 ? 'q' : '');
  return `${rows.join('/')} ${pos.turn === 1 ? 'w' : 'b'} ${c || '-'} ${
    pos.ep >= 0 ? idxToSq(pos.ep) : '-'
  } ${pos.halfmove} ${pos.fullmove}`;
}
