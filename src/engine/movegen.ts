import type { Position, RawMove, Undo } from './types.ts';

const KNIGHT_D = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_D = [
  [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function build(deltas: number[][]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < 64; i++) {
    const r = i >> 3;
    const f = i & 7;
    const list: number[] = [];
    for (const [dr, df] of deltas) {
      const nr = r + dr;
      const nf = f + df;
      if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) list.push(nr * 8 + nf);
    }
    out.push(list);
  }
  return out;
}

const KNIGHT = build(KNIGHT_D);
const KING = build(KING_D);
// index 0 = white pawn attacks (towards rank 8 = lower index), 1 = black
const PAWN_ATT = [build([[-1, -1], [-1, 1]]), build([[1, -1], [1, 1]])];

// RAYS[sq][dir]: dirs 0-3 orthogonal, 4-7 diagonal
const RAYS: number[][][] = [];
for (let i = 0; i < 64; i++) {
  const dirs: number[][] = [];
  for (const [dr, df] of KING_D) {
    const ray: number[] = [];
    let r = (i >> 3) + dr;
    let f = (i & 7) + df;
    while (r >= 0 && r < 8 && f >= 0 && f < 8) {
      ray.push(r * 8 + f);
      r += dr;
      f += df;
    }
    dirs.push(ray);
  }
  RAYS.push(dirs);
}

const CASTLE_MASK = new Int8Array(64).fill(15);
CASTLE_MASK[60] = 12;
CASTLE_MASK[63] = 14;
CASTLE_MASK[56] = 13;
CASTLE_MASK[4] = 3;
CASTLE_MASK[7] = 11;
CASTLE_MASK[0] = 7;

/** Is square `sq` attacked by side `by` (1 white, -1 black)? */
export function isAttacked(pos: Position, sq: number, by: 1 | -1): boolean {
  const b = pos.board;
  // pawns of colour `by` attack sq from where an opposite-colour pawn on sq would attack
  for (const t of PAWN_ATT[by === 1 ? 1 : 0][sq]) if (b[t] === by) return true;
  for (const t of KNIGHT[sq]) if (b[t] === 2 * by) return true;
  for (const t of KING[sq]) if (b[t] === 6 * by) return true;
  const rays = RAYS[sq];
  for (let d = 0; d < 8; d++) {
    const ray = rays[d];
    for (let k = 0; k < ray.length; k++) {
      const v = b[ray[k]];
      if (v === 0) continue;
      if (v * by > 0) {
        const t = v * by;
        if (t === 5 || (d < 4 ? t === 4 : t === 3)) return true;
      }
      break;
    }
  }
  return false;
}

export function inCheck(pos: Position): boolean {
  return isAttacked(pos, pos.kings[pos.turn === 1 ? 0 : 1], (-pos.turn) as 1 | -1);
}

function add(out: RawMove[], from: number, to: number, piece: number, captured: number, promo: number, flags: number) {
  out.push({ from, to, piece, captured, promo, flags });
}

export function pseudoMoves(pos: Position): RawMove[] {
  const out: RawMove[] = [];
  const b = pos.board;
  const c = pos.turn;
  const ci = c === 1 ? 0 : 1;
  for (let i = 0; i < 64; i++) {
    const v = b[i];
    if (v * c <= 0) continue;
    const t = v * c;
    if (t === 1) {
      const fwd = i + (c === 1 ? -8 : 8);
      const lastRow = c === 1 ? 0 : 7;
      const startRow = c === 1 ? 6 : 1;
      if (b[fwd] === 0) {
        if (fwd >> 3 === lastRow) {
          for (let p = 5; p >= 2; p--) add(out, i, fwd, 1, 0, p, 0);
        } else {
          add(out, i, fwd, 1, 0, 0, 0);
          const fwd2 = fwd + (fwd - i);
          if (i >> 3 === startRow && b[fwd2] === 0) add(out, i, fwd2, 1, 0, 0, 1);
        }
      }
      for (const to of PAWN_ATT[ci][i]) {
        const tv = b[to];
        if (tv * c < 0) {
          if (to >> 3 === lastRow) {
            for (let p = 5; p >= 2; p--) add(out, i, to, 1, -tv * c, p, 0);
          } else add(out, i, to, 1, -tv * c, 0, 0);
        } else if (tv === 0 && to === pos.ep) {
          add(out, i, to, 1, 1, 0, 2);
        }
      }
    } else if (t === 2 || t === 6) {
      for (const to of t === 2 ? KNIGHT[i] : KING[i]) {
        const tv = b[to];
        if (tv * c <= 0) add(out, i, to, t, -tv * c, 0, 0);
      }
    } else {
      const rays = RAYS[i];
      const d0 = t === 3 ? 4 : 0;
      const d1 = t === 4 ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        for (const sq of rays[d]) {
          const tv = b[sq];
          if (tv === 0) add(out, i, sq, t, 0, 0, 0);
          else {
            if (tv * c < 0) add(out, i, sq, t, -tv * c, 0, 0);
            break;
          }
        }
      }
    }
  }
  // castling
  const opp = (-c) as 1 | -1;
  const home = c === 1 ? 60 : 4;
  if (b[home] === 6 * c && pos.castling & (c === 1 ? 3 : 12) && !isAttacked(pos, home, opp)) {
    if (
      pos.castling & (c === 1 ? 1 : 4) &&
      b[home + 3] === 4 * c &&
      b[home + 1] === 0 &&
      b[home + 2] === 0 &&
      !isAttacked(pos, home + 1, opp) &&
      !isAttacked(pos, home + 2, opp)
    ) {
      add(out, home, home + 2, 6, 0, 0, 4);
    }
    if (
      pos.castling & (c === 1 ? 2 : 8) &&
      b[home - 4] === 4 * c &&
      b[home - 1] === 0 &&
      b[home - 2] === 0 &&
      b[home - 3] === 0 &&
      !isAttacked(pos, home - 1, opp) &&
      !isAttacked(pos, home - 2, opp)
    ) {
      add(out, home, home - 2, 6, 0, 0, 8);
    }
  }
  return out;
}

export function makeMove(pos: Position, m: RawMove): Undo {
  const undo: Undo = { castling: pos.castling, ep: pos.ep, halfmove: pos.halfmove, fullmove: pos.fullmove };
  const b = pos.board;
  const c = pos.turn;
  b[m.from] = 0;
  b[m.to] = (m.promo || m.piece) * c;
  if (m.flags & 2) b[m.to + (c === 1 ? 8 : -8)] = 0;
  else if (m.flags & 4) {
    b[m.to + 1] = 0;
    b[m.to - 1] = 4 * c;
  } else if (m.flags & 8) {
    b[m.to - 2] = 0;
    b[m.to + 1] = 4 * c;
  }
  if (m.piece === 6) pos.kings[c === 1 ? 0 : 1] = m.to;
  pos.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
  pos.ep = m.flags & 1 ? (m.from + m.to) >> 1 : -1;
  pos.halfmove = m.piece === 1 || m.captured ? 0 : pos.halfmove + 1;
  if (c === -1) pos.fullmove++;
  pos.turn = (-c) as 1 | -1;
  return undo;
}

export function unmakeMove(pos: Position, m: RawMove, u: Undo): void {
  const b = pos.board;
  const c = (-pos.turn) as 1 | -1; // the mover
  pos.turn = c;
  b[m.from] = m.piece * c;
  if (m.flags & 2) {
    b[m.to] = 0;
    b[m.to + (c === 1 ? 8 : -8)] = -c;
  } else {
    b[m.to] = m.captured ? -m.captured * c : 0;
    if (m.flags & 4) {
      b[m.to + 1] = 4 * c;
      b[m.to - 1] = 0;
    } else if (m.flags & 8) {
      b[m.to - 2] = 4 * c;
      b[m.to + 1] = 0;
    }
  }
  if (m.piece === 6) pos.kings[c === 1 ? 0 : 1] = m.from;
  pos.castling = u.castling;
  pos.ep = u.ep;
  pos.halfmove = u.halfmove;
  pos.fullmove = u.fullmove;
}

export function legalMoves(pos: Position): RawMove[] {
  const c = pos.turn;
  const ki = c === 1 ? 0 : 1;
  const out: RawMove[] = [];
  for (const m of pseudoMoves(pos)) {
    const u = makeMove(pos, m);
    if (!isAttacked(pos, pos.kings[ki], (-c) as 1 | -1)) out.push(m);
    unmakeMove(pos, m, u);
  }
  return out;
}

export function perftCount(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    const u = makeMove(pos, m);
    n += perftCount(pos, depth - 1);
    unmakeMove(pos, m, u);
  }
  return n;
}
