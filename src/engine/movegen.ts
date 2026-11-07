import type { Color } from "./types.ts";
import type { Position } from "./board.ts";

/** Internal move. Pieces are board chars; promo is a lowercase type or "". */
export interface IMove {
  from: number;
  to: number;
  piece: string;
  cap: string;
  promo: string;
  ep: boolean;
  castle: "" | "k" | "q";
  dbl: boolean;
}

export interface Undo {
  castling: number;
  ep: number;
  half: number;
  full: number;
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function isAttacked(pos: Position, idx: number, by: Color): boolean {
  const sq = pos.sq;
  const r = idx >> 3;
  const f = idx & 7;
  const white = by === "w";
  // white pawns attack toward row 0, so an attacking white pawn sits at row+1
  const pr = white ? r + 1 : r - 1;
  if (pr >= 0 && pr < 8) {
    const pp = white ? "P" : "p";
    if (f > 0 && sq[pr * 8 + f - 1] === pp) return true;
    if (f < 7 && sq[pr * 8 + f + 1] === pp) return true;
  }
  const n = white ? "N" : "n";
  for (const [dr, df] of KNIGHT) {
    const rr = r + dr;
    const ff = f + df;
    if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && sq[rr * 8 + ff] === n) return true;
  }
  const k = white ? "K" : "k";
  for (const [dr, df] of KING) {
    const rr = r + dr;
    const ff = f + df;
    if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && sq[rr * 8 + ff] === k) return true;
  }
  const q = white ? "Q" : "q";
  const rk = white ? "R" : "r";
  const bs = white ? "B" : "b";
  for (const [dr, df] of DIAG) {
    let rr = r + dr;
    let ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = sq[rr * 8 + ff];
      if (p) {
        if (p === q || p === bs) return true;
        break;
      }
      rr += dr;
      ff += df;
    }
  }
  for (const [dr, df] of ORTH) {
    let rr = r + dr;
    let ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = sq[rr * 8 + ff];
      if (p) {
        if (p === q || p === rk) return true;
        break;
      }
      rr += dr;
      ff += df;
    }
  }
  return false;
}

export function findKing(pos: Position, c: Color): number {
  return pos.sq.indexOf(c === "w" ? "K" : "k");
}

export function inCheck(pos: Position, c: Color): boolean {
  return isAttacked(pos, findKing(pos, c), c === "w" ? "b" : "w");
}

function isOwn(p: string, white: boolean): boolean {
  return p !== "" && (p === p.toUpperCase()) === white;
}

export function pseudoMoves(pos: Position): IMove[] {
  const sq = pos.sq;
  const white = pos.turn === "w";
  const enemy: Color = white ? "b" : "w";
  const out: IMove[] = [];
  const push = (from: number, to: number, piece: string, extra?: Partial<IMove>) => {
    out.push({ from, to, piece, cap: sq[to], promo: "", ep: false, castle: "", dbl: false, ...extra });
  };
  for (let from = 0; from < 64; from++) {
    const piece = sq[from];
    if (!piece || !isOwn(piece, white)) continue;
    const r = from >> 3;
    const f = from & 7;
    const t = piece.toLowerCase();
    if (t === "p") {
      const dir = white ? -1 : 1;
      const startRow = white ? 6 : 1;
      const lastRow = white ? 0 : 7;
      const nr = r + dir;
      const addPawn = (to: number) => {
        if (nr === lastRow) for (const pr of ["q", "r", "b", "n"]) push(from, to, piece, { promo: pr });
        else push(from, to, piece);
      };
      if (!sq[nr * 8 + f]) {
        addPawn(nr * 8 + f);
        if (r === startRow && !sq[(nr + dir) * 8 + f]) push(from, (nr + dir) * 8 + f, piece, { dbl: true });
      }
      for (const df of [-1, 1]) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        const to = nr * 8 + ff;
        if (sq[to] && !isOwn(sq[to], white)) addPawn(to);
        else if (!sq[to] && to === pos.ep) push(from, to, piece, { cap: white ? "p" : "P", ep: true });
      }
    } else if (t === "n" || t === "k") {
      for (const [dr, df] of t === "n" ? KNIGHT : KING) {
        const rr = r + dr;
        const ff = f + df;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
        const to = rr * 8 + ff;
        if (!isOwn(sq[to], white)) push(from, to, piece);
      }
      if (t === "k") {
        const base = white ? 60 : 4;
        if (from === base) {
          const ks = white ? 1 : 4;
          const qs = white ? 2 : 8;
          if (
            pos.castling & ks && !sq[base + 1] && !sq[base + 2] &&
            !isAttacked(pos, base, enemy) && !isAttacked(pos, base + 1, enemy) && !isAttacked(pos, base + 2, enemy)
          ) push(from, base + 2, piece, { castle: "k" });
          if (
            pos.castling & qs && !sq[base - 1] && !sq[base - 2] && !sq[base - 3] &&
            !isAttacked(pos, base, enemy) && !isAttacked(pos, base - 1, enemy) && !isAttacked(pos, base - 2, enemy)
          ) push(from, base - 2, piece, { castle: "q" });
        }
      }
    } else {
      const dirs = t === "b" ? DIAG : t === "r" ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, df] of dirs) {
        let rr = r + dr;
        let ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const to = rr * 8 + ff;
          if (sq[to]) {
            if (!isOwn(sq[to], white)) push(from, to, piece);
            break;
          }
          push(from, to, piece);
          rr += dr;
          ff += df;
        }
      }
    }
  }
  return out;
}

const RIGHTS_MASK: Record<number, number> = { 60: ~3, 4: ~12, 63: ~1, 56: ~2, 7: ~4, 0: ~8 };

export function makeMove(pos: Position, m: IMove): Undo {
  const undo: Undo = { castling: pos.castling, ep: pos.ep, half: pos.half, full: pos.full };
  const sq = pos.sq;
  const white = pos.turn === "w";
  sq[m.from] = "";
  sq[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : m.piece;
  if (m.ep) sq[m.to + (white ? 8 : -8)] = "";
  if (m.castle) {
    const row = m.from - (m.from & 7);
    if (m.castle === "k") {
      sq[row + 5] = sq[row + 7];
      sq[row + 7] = "";
    } else {
      sq[row + 3] = sq[row];
      sq[row] = "";
    }
  }
  pos.castling &= (RIGHTS_MASK[m.from] ?? -1) & (RIGHTS_MASK[m.to] ?? -1);
  pos.ep = m.dbl ? (m.from + m.to) >> 1 : -1;
  pos.half = m.piece.toLowerCase() === "p" || m.cap ? 0 : pos.half + 1;
  if (!white) pos.full++;
  pos.turn = white ? "b" : "w";
  return undo;
}

export function unmakeMove(pos: Position, m: IMove, u: Undo): void {
  const sq = pos.sq;
  pos.turn = pos.turn === "w" ? "b" : "w";
  const white = pos.turn === "w";
  sq[m.from] = m.piece;
  sq[m.to] = m.ep ? "" : m.cap;
  if (m.ep) sq[m.to + (white ? 8 : -8)] = m.cap;
  if (m.castle) {
    const row = m.from - (m.from & 7);
    if (m.castle === "k") {
      sq[row + 7] = sq[row + 5];
      sq[row + 5] = "";
    } else {
      sq[row] = sq[row + 3];
      sq[row + 3] = "";
    }
  }
  pos.castling = u.castling;
  pos.ep = u.ep;
  pos.half = u.half;
  pos.full = u.full;
}

export function legalMoves(pos: Position): IMove[] {
  const me = pos.turn;
  const out: IMove[] = [];
  for (const m of pseudoMoves(pos)) {
    const u = makeMove(pos, m);
    if (!inCheck(pos, me)) out.push(m);
    unmakeMove(pos, m, u);
  }
  return out;
}
