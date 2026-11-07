// Chess rules engine: board, legal move generation, game status.
export type Colour = "w" | "b";
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Colour}${PieceType}`;
export type Promo = "q" | "r" | "b" | "n";

export interface Position {
  board: (Piece | null)[]; // index 0 = a8, 63 = h1
  turn: Colour;
  castling: string; // subset of "KQkq" or "-"
  ep: number; // en passant target index, -1 none
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  promo?: Promo;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const sq = (name: string): number => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
export const sqName = (i: number): string => String.fromCharCode(97 + (i % 8)) + (8 - (i >> 3));

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) throw new Error("Bad FEN");
  const board: (Piece | null)[] = [];
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("Bad FEN");
  for (const row of rows) {
    for (const ch of row) {
      if (/[1-8]/.test(ch)) for (let k = 0; k < Number(ch); k++) board.push(null);
      else if (/[pnbrqkPNBRQK]/.test(ch))
        board.push(((ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase()) as Piece);
      else throw new Error("Bad FEN");
    }
  }
  if (board.length !== 64) throw new Error("Bad FEN");
  if (!board.includes("wK") || !board.includes("bK")) throw new Error("Bad FEN");
  const turn = parts[1] === "b" ? "b" : "w";
  const castling = parts[2] && parts[2] !== "-" ? parts[2] : "-";
  const ep = parts[3] && /^[a-h][36]$/.test(parts[3]) ? sq(parts[3]) : -1;
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
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const pc = p.board[r * 8 + f];
      if (!pc) empty++;
      else {
        if (empty) s += empty;
        empty = 0;
        s += pc[0] === "w" ? pc[1] : pc[1].toLowerCase();
      }
    }
    if (empty) s += empty;
    rows.push(s);
  }
  return `${rows.join("/")} ${p.turn} ${p.castling} ${p.ep < 0 ? "-" : sqName(p.ep)} ${p.halfmove} ${p.fullmove}`;
}

const KNIGHT = [-17, -15, -10, -6, 6, 10, 15, 17];
const KING = [-9, -8, -7, -1, 1, 7, 8, 9];
const DIAG = [-9, -7, 7, 9];
const ORTHO = [-8, -1, 1, 8];

function step(from: number, d: number): number {
  const to = from + d;
  if (to < 0 || to > 63) return -1;
  if (Math.abs((to & 7) - (from & 7)) > 2) return -1; // wrapped around the board edge
  return to;
}
function stepOne(from: number, d: number): number {
  const to = step(from, d);
  if (to < 0 || Math.abs((to & 7) - (from & 7)) > 1) return -1;
  return to;
}

export function isAttacked(board: (Piece | null)[], target: number, by: Colour): boolean {
  const pd = by === "w" ? [7, 9] : [-9, -7]; // offsets from target to squares a pawn of `by` attacks from
  for (const d of pd) {
    const f = stepOne(target, d);
    if (f >= 0 && board[f] === by + "P") return true;
  }
  for (const d of KNIGHT) {
    const f = step(target, d);
    if (f >= 0 && board[f] === by + "N") return true;
  }
  for (const d of KING) {
    const f = stepOne(target, d);
    if (f >= 0 && board[f] === by + "K") return true;
  }
  for (const [dirs, t] of [[DIAG, "B"], [ORTHO, "R"]] as const) {
    for (const d of dirs) {
      let s = target;
      for (;;) {
        s = stepOne(s, d);
        if (s < 0) break;
        const pc = board[s];
        if (pc) {
          if (pc[0] === by && (pc[1] === t || pc[1] === "Q")) return true;
          break;
        }
      }
    }
  }
  return false;
}

const other = (c: Colour): Colour => (c === "w" ? "b" : "w");

export function kingSquare(board: (Piece | null)[], c: Colour): number {
  return board.indexOf((c + "K") as Piece);
}

export function inCheck(p: Position, c: Colour = p.turn): boolean {
  const k = kingSquare(p.board, c);
  return k >= 0 && isAttacked(p.board, k, other(c));
}

function pseudoMoves(p: Position): Move[] {
  const out: Move[] = [];
  const us = p.turn;
  const them = other(us);
  const b = p.board;
  for (let from = 0; from < 64; from++) {
    const pc = b[from];
    if (!pc || pc[0] !== us) continue;
    const t = pc[1] as PieceType;
    if (t === "P") {
      const dir = us === "w" ? -8 : 8;
      const startRank = us === "w" ? 6 : 1;
      const lastRank = us === "w" ? 0 : 7;
      const add = (to: number) => {
        if (to >> 3 === lastRank) for (const pr of ["q", "r", "b", "n"] as Promo[]) out.push({ from, to, promo: pr });
        else out.push({ from, to });
      };
      const one = from + dir;
      if (one >= 0 && one < 64 && !b[one]) {
        add(one);
        if (from >> 3 === startRank && !b[one + dir]) out.push({ from, to: one + dir });
      }
      for (const d of [dir - 1, dir + 1]) {
        const to = stepOne(from, d);
        if (to < 0) continue;
        if ((b[to] && b[to]![0] === them) || (to === p.ep && !b[to])) add(to);
      }
    } else if (t === "N" || t === "K") {
      for (const d of t === "N" ? KNIGHT : KING) {
        const to = t === "N" ? step(from, d) : stepOne(from, d);
        if (to >= 0 && (!b[to] || b[to]![0] === them)) out.push({ from, to });
      }
      if (t === "K") castleMoves(p, from, out);
    } else {
      const dirs = t === "B" ? DIAG : t === "R" ? ORTHO : [...DIAG, ...ORTHO];
      for (const d of dirs) {
        let s = from;
        for (;;) {
          s = stepOne(s, d);
          if (s < 0) break;
          if (b[s]) {
            if (b[s]![0] === them) out.push({ from, to: s });
            break;
          }
          out.push({ from, to: s });
        }
      }
    }
  }
  return out;
}

function castleMoves(p: Position, from: number, out: Move[]) {
  const us = p.turn;
  const row = us === "w" ? 56 : 0;
  if (from !== row + 4) return;
  const b = p.board;
  const them = other(us);
  if (isAttacked(b, from, them)) return;
  const K = us === "w" ? "K" : "k";
  const Q = us === "w" ? "Q" : "q";
  if (p.castling.includes(K) && b[row + 7] === us + "R" && !b[row + 5] && !b[row + 6]
    && !isAttacked(b, row + 5, them) && !isAttacked(b, row + 6, them)) out.push({ from, to: row + 6 });
  if (p.castling.includes(Q) && b[row] === us + "R" && !b[row + 1] && !b[row + 2] && !b[row + 3]
    && !isAttacked(b, row + 3, them) && !isAttacked(b, row + 2, them)) out.push({ from, to: row + 2 });
}

export function makeMove(p: Position, m: Move): Position {
  const board = p.board.slice();
  const pc = board[m.from]!;
  const us = pc[0] as Colour;
  const type = pc[1];
  const captured = board[m.to];
  let ep = -1;
  board[m.from] = null;
  board[m.to] = m.promo ? ((us + m.promo.toUpperCase()) as Piece) : pc;
  if (type === "P") {
    if (m.to === p.ep && !captured && (m.from & 7) !== (m.to & 7)) board[m.to + (us === "w" ? 8 : -8)] = null;
    if (Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2;
  }
  if (type === "K" && Math.abs(m.to - m.from) === 2) {
    const row = m.from & ~7;
    if (m.to > m.from) { board[row + 5] = board[row + 7]; board[row + 7] = null; }
    else { board[row + 3] = board[row]; board[row] = null; }
  }
  let castling = p.castling === "-" ? "" : p.castling;
  const strip = (s: string) => { castling = castling.split("").filter((c) => !s.includes(c)).join(""); };
  if (type === "K") strip(us === "w" ? "KQ" : "kq");
  for (const s of [m.from, m.to]) {
    if (s === 63) strip("K");
    if (s === 56) strip("Q");
    if (s === 7) strip("k");
    if (s === 0) strip("q");
  }
  return {
    board,
    turn: other(us),
    castling: castling || "-",
    ep,
    halfmove: type === "P" || captured ? 0 : p.halfmove + 1,
    fullmove: p.fullmove + (us === "b" ? 1 : 0),
  };
}

export function legalMoves(p: Position): Move[] {
  return pseudoMoves(p).filter((m) => !inCheck(makeMove(p, m), p.turn));
}

export function perft(p: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(p);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(makeMove(p, m), depth - 1);
  return n;
}

export function uci(m: Move): string {
  return sqName(m.from) + sqName(m.to) + (m.promo ?? "");
}
export function parseUci(s: string): Move {
  return { from: sq(s.slice(0, 2)), to: sq(s.slice(2, 4)), promo: (s[4] as Promo) || undefined };
}

// Repetition key: placement, side, castling, and ep only if an ep capture is legal.
export function positionKey(p: Position): string {
  let ep = "-";
  if (p.ep >= 0 && legalMoves(p).some((m) => m.to === p.ep && p.board[m.from]![1] === "P")) ep = sqName(p.ep);
  return toFen(p).split(" ").slice(0, 3).join(" ") + " " + ep;
}

export type Status =
  | { kind: "playing"; check: boolean }
  | { kind: "checkmate"; winner: Colour }
  | { kind: "stalemate" }
  | { kind: "threefold" }
  | { kind: "fifty" }
  | { kind: "insufficient" };

export function insufficientMaterial(p: Position): boolean {
  const minors: number[] = [];
  let knights = 0;
  for (let i = 0; i < 64; i++) {
    const pc = p.board[i];
    if (!pc || pc[1] === "K") continue;
    if (pc[1] === "B" || pc[1] === "N") {
      minors.push(i);
      if (pc[1] === "N") knights++;
    } else return false;
  }
  if (minors.length <= 1) return true;
  const shade = (i: number) => ((i >> 3) + (i & 7)) % 2;
  return knights === 0 && minors.every((i) => shade(i) === shade(minors[0]));
}

export class Game {
  positions: Position[];
  moves: Move[] = [];
  keys: string[];
  constructor(fen: string = START_FEN) {
    const p = parseFen(fen);
    this.positions = [p];
    this.keys = [positionKey(p)];
  }
  get position(): Position { return this.positions[this.positions.length - 1]; }
  get lastMove(): Move | undefined { return this.moves[this.moves.length - 1]; }
  legal(): Move[] { return legalMoves(this.position); }
  movesFrom(from: number): Move[] { return this.legal().filter((m) => m.from === from); }
  /** Plays a move if legal and the game is still running. Promotions need `promo`. */
  play(m: Move): boolean {
    if (this.status().kind !== "playing") return false;
    const found = this.legal().find((x) => x.from === m.from && x.to === m.to && x.promo === m.promo);
    if (!found) return false;
    const next = makeMove(this.position, found);
    this.positions.push(next);
    this.moves.push(found);
    this.keys.push(positionKey(next));
    return true;
  }
  isPromotion(from: number, to: number): boolean {
    return this.legal().some((m) => m.from === from && m.to === to && m.promo);
  }
  status(): Status {
    const p = this.position;
    const check = inCheck(p);
    if (legalMoves(p).length === 0)
      return check ? { kind: "checkmate", winner: other(p.turn) } : { kind: "stalemate" };
    const key = this.keys[this.keys.length - 1];
    if (this.keys.filter((k) => k === key).length >= 3) return { kind: "threefold" };
    if (p.halfmove >= 100) return { kind: "fifty" };
    if (insufficientMaterial(p)) return { kind: "insufficient" };
    return { kind: "playing", check };
  }
}
