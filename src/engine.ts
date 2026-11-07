export type Color = "w" | "b";
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Color}${PieceType}`;
export type Cell = Piece | null;
export type Promo = "q" | "r" | "b" | "n";

export interface Position {
  board: Cell[]; // index 0 = a8 ... 63 = h1
  turn: Color;
  castling: string; // subset of KQkq
  ep: number; // en passant target square index or -1
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  promo?: Promo;
  flag?: "ep" | "castleK" | "castleQ" | "double";
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const sqName = (i: number) => "abcdefgh"[i % 8] + (8 - Math.floor(i / 8));
export const sqIndex = (s: string) => "abcdefgh".indexOf(s[0]) + (8 - Number(s[1])) * 8;
const file = (i: number) => i % 8;
const rank = (i: number) => Math.floor(i / 8);

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) throw new Error("Bad FEN");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("Bad FEN");
  const board: Cell[] = [];
  for (const row of rows) {
    let n = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let k = 0; k < Number(ch); k++) board.push(null);
        n += Number(ch);
      } else {
        if (!/[pnbrqkPNBRQK]/.test(ch)) throw new Error("Bad FEN");
        board.push(((ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase()) as Piece);
        n++;
      }
    }
    if (n !== 8) throw new Error("Bad FEN");
  }
  const turn: Color = parts[1] === "b" ? "b" : "w";
  const castling = (parts[2] ?? "-").replace(/[^KQkq]/g, "");
  const ep = parts[3] && parts[3] !== "-" ? sqIndex(parts[3]) : -1;
  return {
    board,
    turn,
    castling,
    ep,
    halfmove: Number(parts[4] ?? 0) || 0,
    fullmove: Number(parts[5] ?? 1) || 1,
  };
}

export function toFen(p: Position): string {
  let s = "";
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let f = 0; f < 8; f++) {
      const c = p.board[r * 8 + f];
      if (!c) e++;
      else {
        if (e) s += e;
        e = 0;
        s += c[0] === "w" ? c[1] : c[1].toLowerCase();
      }
    }
    if (e) s += e;
    if (r < 7) s += "/";
  }
  return `${s} ${p.turn} ${p.castling || "-"} ${p.ep >= 0 ? sqName(p.ep) : "-"} ${p.halfmove} ${p.fullmove}`;
}

const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const other = (c: Color): Color => (c === "w" ? "b" : "w");

export function isAttacked(board: Cell[], sq: number, by: Color): boolean {
  const f = file(sq), r = rank(sq);
  const inside = (nf: number, nr: number) => nf >= 0 && nf < 8 && nr >= 0 && nr < 8;
  const at = (df: number, dr: number): Cell =>
    inside(f + df, r + dr) ? board[(r + dr) * 8 + f + df] : null;
  const pr = by === "w" ? 1 : -1; // a white pawn attacks the square diagonally above it
  for (const df of [-1, 1]) if (at(df, pr) === `${by}P`) return true;
  for (const [df, dr] of KN) if (at(df, dr) === `${by}N`) return true;
  for (const [df, dr] of KG) if (at(df, dr) === `${by}K`) return true;
  const slide = (dirs: number[][], a: string, b: string) => {
    for (const [df, dr] of dirs) {
      for (let k = 1; k < 8; k++) {
        if (!inside(f + df * k, r + dr * k)) break;
        const c = board[(r + dr * k) * 8 + f + df * k];
        if (!c) continue;
        if (c === by + a || c === by + b) return true;
        break;
      }
    }
    return false;
  };
  return slide(DIAG, "B", "Q") || slide(ORTH, "R", "Q");
}

export function findKing(board: Cell[], c: Color): number {
  return board.indexOf(`${c}K`);
}

export function inCheck(p: Position, c: Color = p.turn): boolean {
  const k = findKing(p.board, c);
  return k >= 0 && isAttacked(p.board, k, other(c));
}

function pseudoMoves(p: Position): Move[] {
  const out: Move[] = [];
  const { board, turn } = p;
  const add = (from: number, to: number, extra: Partial<Move> = {}) => out.push({ from, to, ...extra });
  for (let i = 0; i < 64; i++) {
    const pc = board[i];
    if (!pc || pc[0] !== turn) continue;
    const f = file(i), r = rank(i);
    const t = pc[1] as PieceType;
    if (t === "P") {
      const dir = turn === "w" ? -1 : 1;
      const startRank = turn === "w" ? 6 : 1;
      const lastRank = turn === "w" ? 0 : 7;
      const push = (to: number) => {
        if (rank(to) === lastRank) for (const promo of ["q", "r", "b", "n"] as Promo[]) add(i, to, { promo });
        else add(i, to);
      };
      const one = i + dir * 8;
      if (one < 0 || one > 63) continue;
      if (!board[one]) {
        push(one);
        const two = i + dir * 16;
        if (r === startRank && !board[two]) add(i, two, { flag: "double" });
      }
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const to = one + df;
        const tgt = board[to];
        if (tgt && tgt[0] !== turn) push(to);
        else if (!tgt && to === p.ep) add(i, to, { flag: "ep" });
      }
    } else if (t === "N" || t === "K") {
      for (const [df, dr] of t === "N" ? KN : KG) {
        const nf = f + df, nr = r + dr;
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const to = nr * 8 + nf;
        const c = board[to];
        if (!c || c[0] !== turn) add(i, to);
      }
    } else {
      const dirs = t === "B" ? DIAG : t === "R" ? ORTH : [...DIAG, ...ORTH];
      for (const [df, dr] of dirs) {
        for (let k = 1; k < 8; k++) {
          const nf = f + df * k, nr = r + dr * k;
          if (nf < 0 || nf > 7 || nr < 0 || nr > 7) break;
          const to = nr * 8 + nf;
          const c = board[to];
          if (!c) add(i, to);
          else {
            if (c[0] !== turn) add(i, to);
            break;
          }
        }
      }
    }
  }
  const home = turn === "w" ? 60 : 4;
  const foe = other(turn);
  if (board[home] === `${turn}K` && !isAttacked(board, home, foe)) {
    const ks = turn === "w" ? "K" : "k", qs = turn === "w" ? "Q" : "q";
    if (
      p.castling.includes(ks) && board[home + 3] === `${turn}R` &&
      !board[home + 1] && !board[home + 2] &&
      !isAttacked(board, home + 1, foe) && !isAttacked(board, home + 2, foe)
    ) add(home, home + 2, { flag: "castleK" });
    if (
      p.castling.includes(qs) && board[home - 4] === `${turn}R` &&
      !board[home - 1] && !board[home - 2] && !board[home - 3] &&
      !isAttacked(board, home - 1, foe) && !isAttacked(board, home - 2, foe)
    ) add(home, home - 2, { flag: "castleQ" });
  }
  return out;
}

export function applyMove(p: Position, m: Move): Position {
  const board = p.board.slice();
  const pc = board[m.from]!;
  const captured = board[m.to];
  board[m.to] = pc;
  board[m.from] = null;
  if (m.flag === "ep") board[m.to + (p.turn === "w" ? 8 : -8)] = null;
  if (m.flag === "castleK") { board[m.from + 1] = board[m.from + 3]; board[m.from + 3] = null; }
  if (m.flag === "castleQ") { board[m.from - 1] = board[m.from - 4]; board[m.from - 4] = null; }
  if (m.promo) board[m.to] = `${p.turn}${m.promo.toUpperCase()}` as Piece;
  let castling = p.castling;
  const strip = (s: string) => { castling = castling.split("").filter((c) => !s.includes(c)).join(""); };
  if (pc[1] === "K") strip(p.turn === "w" ? "KQ" : "kq");
  for (const sq of [m.from, m.to]) {
    if (sq === 63) strip("K");
    if (sq === 56) strip("Q");
    if (sq === 7) strip("k");
    if (sq === 0) strip("q");
  }
  return {
    board,
    turn: other(p.turn),
    castling,
    ep: m.flag === "double" ? (m.from + m.to) / 2 : -1,
    halfmove: pc[1] === "P" || captured || m.flag === "ep" ? 0 : p.halfmove + 1,
    fullmove: p.fullmove + (p.turn === "b" ? 1 : 0),
  };
}

export function legalMoves(p: Position): Move[] {
  return pseudoMoves(p).filter((m) => !inCheck(applyMove(p, m), p.turn));
}

export function perft(p: Position, depth: number): number {
  if (depth === 0) return 1;
  const ms = legalMoves(p);
  if (depth === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += perft(applyMove(p, m), depth - 1);
  return n;
}

export function moveToUci(m: Move): string {
  return sqName(m.from) + sqName(m.to) + (m.promo ?? "");
}

export function findMove(p: Position, uci: string): Move | undefined {
  return legalMoves(p).find((m) => moveToUci(m) === uci);
}

export function insufficientMaterial(p: Position): boolean {
  const pieces = p.board.filter((c): c is Piece => !!c && c[1] !== "K");
  return pieces.length === 0 || (pieces.length === 1 && (pieces[0][1] === "B" || pieces[0][1] === "N"));
}

/** Repetition key: placement, side, castling rights, and ep only when a legal ep capture exists. */
export function positionKey(p: Position): string {
  const epOk = p.ep >= 0 && legalMoves(p).some((m) => m.flag === "ep");
  return toFen({ ...p, ep: epOk ? p.ep : -1, halfmove: 0, fullmove: 0 });
}

export type Outcome =
  | { over: false }
  | {
      over: true;
      result: "1-0" | "0-1" | "1/2-1/2";
      reason: "checkmate" | "stalemate" | "threefold repetition" | "fifty-move rule" | "insufficient material";
      text: string;
    };

export class Game {
  pos: Position;
  keys: string[];
  last: Move | null = null;
  constructor(fen: string = START_FEN) {
    this.pos = parseFen(fen);
    this.keys = [positionKey(this.pos)];
  }
  legal(): Move[] {
    return legalMoves(this.pos);
  }
  play(m: Move): void {
    this.pos = applyMove(this.pos, m);
    this.last = m;
    this.keys.push(positionKey(this.pos));
  }
  outcome(): Outcome {
    if (this.legal().length === 0) {
      if (inCheck(this.pos)) {
        const w = this.pos.turn === "b";
        return { over: true, result: w ? "1-0" : "0-1", reason: "checkmate", text: `Checkmate — ${w ? "White" : "Black"} wins` };
      }
      return { over: true, result: "1/2-1/2", reason: "stalemate", text: "Stalemate — draw" };
    }
    const k = this.keys[this.keys.length - 1];
    if (this.keys.filter((x) => x === k).length >= 3)
      return { over: true, result: "1/2-1/2", reason: "threefold repetition", text: "Draw by threefold repetition" };
    if (this.pos.halfmove >= 100)
      return { over: true, result: "1/2-1/2", reason: "fifty-move rule", text: "Draw by the 50-move rule" };
    if (insufficientMaterial(this.pos))
      return { over: true, result: "1/2-1/2", reason: "insufficient material", text: "Draw — insufficient material" };
    return { over: false };
  }
}
