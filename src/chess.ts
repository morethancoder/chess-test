// Chess rules engine: board state, legal move generation, game status, SAN.
// Squares are indexed 0..63 with a1 = 0, b1 = 1, ..., h8 = 63.
// Pieces are FEN letters: uppercase white (PNBRQK), lowercase black (pnbrqk).

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = string; // one FEN letter
export type PromoType = "q" | "r" | "b" | "n";

export interface Move {
  from: number;
  to: number;
  piece: Piece;
  captured?: Piece;
  promotion?: PromoType;
  enPassant?: boolean;
  castle?: "k" | "q";
  doublePush?: boolean;
}

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castling: { K: boolean; Q: boolean; k: boolean; q: boolean };
  ep: number; // en passant target square, -1 if none
  halfmove: number;
  fullmove: number;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FILES = "abcdefgh";

export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
export const squareName = (sq: number) => FILES[fileOf(sq)] + (rankOf(sq) + 1);
export function parseSquare(name: string): number {
  if (!/^[a-h][1-8]$/.test(name)) return -1;
  return (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
}
export const colorOf = (p: Piece): Color => (p === p.toUpperCase() ? "w" : "b");
export const typeOf = (p: Piece) => p.toLowerCase() as PieceType;
const opp = (c: Color): Color => (c === "w" ? "b" : "w");

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error("FEN needs at least 4 fields");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("FEN board needs 8 ranks");
  const board: (Piece | null)[] = new Array(64).fill(null);
  let kings = { w: 0, b: 0 };
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) file += Number(ch);
      else if (/[pnbrqkPNBRQK]/.test(ch)) {
        if (file > 7) throw new Error("FEN rank too long");
        board[rank * 8 + file] = ch;
        if (ch === "K") kings.w++;
        if (ch === "k") kings.b++;
        file++;
      } else throw new Error(`Bad FEN character ${ch}`);
    }
    if (file !== 8) throw new Error("FEN rank has wrong length");
  });
  if (kings.w !== 1 || kings.b !== 1) throw new Error("FEN needs one king per side");
  if (parts[1] !== "w" && parts[1] !== "b") throw new Error("Bad side to move");
  const c = parts[2];
  if (!/^(-|K?Q?k?q?)$/.test(c)) throw new Error("Bad castling field");
  const castling = {
    K: c.includes("K") && board[4] === "K" && board[7] === "R",
    Q: c.includes("Q") && board[4] === "K" && board[0] === "R",
    k: c.includes("k") && board[60] === "k" && board[63] === "r",
    q: c.includes("q") && board[60] === "k" && board[56] === "r",
  };
  const ep = parts[3] === "-" ? -1 : parseSquare(parts[3]);
  if (parts[3] !== "-" && ep < 0) throw new Error("Bad en passant square");
  const halfmove = parts[4] !== undefined ? Number(parts[4]) : 0;
  const fullmove = parts[5] !== undefined ? Number(parts[5]) : 1;
  if (!Number.isInteger(halfmove) || halfmove < 0) throw new Error("Bad halfmove clock");
  if (!Number.isInteger(fullmove) || fullmove < 1) throw new Error("Bad fullmove number");
  return { board, turn: parts[1] as Color, castling, ep, halfmove, fullmove };
}

export function boardFen(pos: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = pos.board[rank * 8 + file];
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join("/");
}

function castlingFen(pos: Position): string {
  const { K, Q, k, q } = pos.castling;
  return (K ? "K" : "") + (Q ? "Q" : "") + (k ? "k" : "") + (q ? "q" : "") || "-";
}

export function toFen(pos: Position): string {
  const ep = pos.ep >= 0 ? squareName(pos.ep) : "-";
  return `${boardFen(pos)} ${pos.turn} ${castlingFen(pos)} ${ep} ${pos.halfmove} ${pos.fullmove}`;
}

const KNIGHT = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function offset(sq: number, df: number, dr: number): number {
  const f = fileOf(sq) + df;
  const r = rankOf(sq) + dr;
  return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f;
}

/** Is `sq` attacked by any piece of colour `by`? */
export function isAttacked(board: (Piece | null)[], sq: number, by: Color): boolean {
  const P = by === "w" ? "P" : "p";
  const N = by === "w" ? "N" : "n";
  const B = by === "w" ? "B" : "b";
  const R = by === "w" ? "R" : "r";
  const Q = by === "w" ? "Q" : "q";
  const K = by === "w" ? "K" : "k";
  // Pawns attack diagonally forward, so look one rank "behind" the square.
  const pr = by === "w" ? -1 : 1;
  for (const df of [-1, 1]) {
    const s = offset(sq, df, pr);
    if (s >= 0 && board[s] === P) return true;
  }
  for (const [df, dr] of KNIGHT) {
    const s = offset(sq, df, dr);
    if (s >= 0 && board[s] === N) return true;
  }
  for (const [df, dr] of KING) {
    const s = offset(sq, df, dr);
    if (s >= 0 && board[s] === K) return true;
  }
  for (const [df, dr] of ROOK_DIRS) {
    let s = offset(sq, df, dr);
    while (s >= 0) {
      const p = board[s];
      if (p) {
        if (p === R || p === Q) return true;
        break;
      }
      s = offset(s, df, dr);
    }
  }
  for (const [df, dr] of BISHOP_DIRS) {
    let s = offset(sq, df, dr);
    while (s >= 0) {
      const p = board[s];
      if (p) {
        if (p === B || p === Q) return true;
        break;
      }
      s = offset(s, df, dr);
    }
  }
  return false;
}

export function kingSquare(board: (Piece | null)[], color: Color): number {
  return board.indexOf(color === "w" ? "K" : "k");
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  return isAttacked(pos.board, kingSquare(pos.board, color), opp(color));
}

function pseudoMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const { board, turn } = pos;
  const own = (p: Piece | null) => p !== null && colorOf(p) === turn;
  const enemy = (p: Piece | null) => p !== null && colorOf(p) !== turn;

  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || colorOf(piece) !== turn) continue;
    const t = typeOf(piece);
    const add = (to: number, extra: Partial<Move> = {}) => {
      const captured = board[to] ?? undefined;
      moves.push({ from, to, piece, ...(captured ? { captured } : {}), ...extra });
    };

    if (t === "p") {
      const dir = turn === "w" ? 1 : -1;
      const startRank = turn === "w" ? 1 : 6;
      const lastRank = turn === "w" ? 7 : 0;
      const pushPawn = (to: number, extra: Partial<Move> = {}) => {
        if (rankOf(to) === lastRank) {
          for (const promotion of ["q", "r", "b", "n"] as PromoType[]) add(to, { ...extra, promotion });
        } else add(to, extra);
      };
      const one = offset(from, 0, dir);
      if (one >= 0 && !board[one]) {
        pushPawn(one);
        const two = offset(from, 0, 2 * dir);
        if (rankOf(from) === startRank && !board[two]) add(two, { doublePush: true });
      }
      for (const df of [-1, 1]) {
        const to = offset(from, df, dir);
        if (to < 0) continue;
        if (enemy(board[to])) pushPawn(to);
        else if (to === pos.ep && !board[to]) {
          const capSq = to - 8 * dir;
          const cap = board[capSq];
          if (cap && typeOf(cap) === "p" && colorOf(cap) !== turn) {
            moves.push({ from, to, piece, captured: cap, enPassant: true });
          }
        }
      }
    } else if (t === "n" || t === "k") {
      for (const [df, dr] of t === "n" ? KNIGHT : KING) {
        const to = offset(from, df, dr);
        if (to >= 0 && !own(board[to])) add(to);
      }
      if (t === "k") addCastles(pos, from, moves);
    } else {
      const dirs = t === "r" ? ROOK_DIRS : t === "b" ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
      for (const [df, dr] of dirs) {
        let to = offset(from, df, dr);
        while (to >= 0) {
          if (own(board[to])) break;
          add(to);
          if (board[to]) break;
          to = offset(to, df, dr);
        }
      }
    }
  }
  return moves;
}

function addCastles(pos: Position, from: number, moves: Move[]) {
  const { board, turn, castling } = pos;
  const home = turn === "w" ? 4 : 60;
  if (from !== home) return;
  const them = opp(turn);
  if (isAttacked(board, home, them)) return; // not out of check
  const king = board[home]!;
  const rook = turn === "w" ? "R" : "r";
  const canK = turn === "w" ? castling.K : castling.k;
  const canQ = turn === "w" ? castling.Q : castling.q;
  // Kingside: f and g empty, king doesn't pass through or land on an attacked square.
  if (canK && board[home + 3] === rook && !board[home + 1] && !board[home + 2] &&
      !isAttacked(board, home + 1, them) && !isAttacked(board, home + 2, them)) {
    moves.push({ from, to: home + 2, piece: king, castle: "k" });
  }
  // Queenside: b, c and d empty; king crosses d and lands on c.
  if (canQ && board[home - 4] === rook && !board[home - 1] && !board[home - 2] && !board[home - 3] &&
      !isAttacked(board, home - 1, them) && !isAttacked(board, home - 2, them)) {
    moves.push({ from, to: home - 2, piece: king, castle: "q" });
  }
}

/** Returns a new position with the move applied. Does not check legality. */
export function applyMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const castling = { ...pos.castling };
  board[m.from] = null;
  board[m.to] = m.promotion
    ? (pos.turn === "w" ? m.promotion.toUpperCase() : m.promotion)
    : m.piece;
  if (m.enPassant) board[m.to + (pos.turn === "w" ? -8 : 8)] = null;
  if (m.castle) {
    const rookFrom = m.castle === "k" ? m.from + 3 : m.from - 4;
    const rookTo = m.castle === "k" ? m.from + 1 : m.from - 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }
  // Any move from or to a corner/king square removes the matching right.
  const touch = (sq: number) => {
    if (sq === 4) castling.K = castling.Q = false;
    if (sq === 60) castling.k = castling.q = false;
    if (sq === 0) castling.Q = false;
    if (sq === 7) castling.K = false;
    if (sq === 56) castling.q = false;
    if (sq === 63) castling.k = false;
  };
  touch(m.from);
  touch(m.to);
  const isPawn = typeOf(m.piece) === "p";
  return {
    board,
    turn: opp(pos.turn),
    castling,
    ep: m.doublePush ? (m.from + m.to) / 2 : -1,
    halfmove: isPawn || m.captured ? 0 : pos.halfmove + 1,
    fullmove: pos.turn === "b" ? pos.fullmove + 1 : pos.fullmove,
  };
}

export function legalMoves(pos: Position): Move[] {
  return pseudoMoves(pos).filter((m) => {
    const next = applyMove(pos, m);
    return !isAttacked(next.board, kingSquare(next.board, pos.turn), next.turn);
  });
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(pos, m), depth - 1);
  return n;
}

export const moveToUci = (m: Move) => squareName(m.from) + squareName(m.to) + (m.promotion ?? "");

/** Key used for repetition: placement, side to move, castling rights, and the
 *  en passant square only when an en passant capture is actually legal. */
export function repetitionKey(pos: Position): string {
  const epLegal = pos.ep >= 0 && legalMoves(pos).some((m) => m.enPassant);
  return `${boardFen(pos)} ${pos.turn} ${castlingFen(pos)} ${epLegal ? squareName(pos.ep) : "-"}`;
}

export function toSan(pos: Position, m: Move, legal: Move[] = legalMoves(pos)): string {
  let san: string;
  const t = typeOf(m.piece);
  if (m.castle) san = m.castle === "k" ? "O-O" : "O-O-O";
  else if (t === "p") {
    san = m.captured ? FILES[fileOf(m.from)] + "x" : "";
    san += squareName(m.to);
    if (m.promotion) san += "=" + m.promotion.toUpperCase();
  } else {
    san = t.toUpperCase();
    const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
    if (rivals.length) {
      const sameFile = rivals.some((o) => fileOf(o.from) === fileOf(m.from));
      const sameRank = rivals.some((o) => rankOf(o.from) === rankOf(m.from));
      if (!sameFile) san += FILES[fileOf(m.from)];
      else if (!sameRank) san += rankOf(m.from) + 1;
      else san += squareName(m.from);
    }
    if (m.captured) san += "x";
    san += squareName(m.to);
  }
  const next = applyMove(pos, m);
  if (inCheck(next)) san += legalMoves(next).length ? "+" : "#";
  return san;
}

export type Status =
  | { over: false; check: boolean }
  | {
      over: true;
      check: boolean;
      reason: "checkmate" | "stalemate" | "threefold" | "fifty-move";
      winner: Color | null;
    };

/** A game: a start position plus the moves played, with repetition tracking. */
export class Game {
  positions: Position[];
  moves: Move[] = [];
  sans: string[] = [];
  private keys: string[];

  constructor(fen: string = START_FEN) {
    const start = parseFen(fen);
    this.positions = [start];
    this.keys = [repetitionKey(start)];
  }

  get pos(): Position {
    return this.positions[this.positions.length - 1];
  }

  get turn(): Color {
    return this.pos.turn;
  }

  get lastMove(): Move | undefined {
    return this.moves[this.moves.length - 1];
  }

  fen(): string {
    return toFen(this.pos);
  }

  legalMoves(): Move[] {
    return this.status().over ? [] : legalMoves(this.pos);
  }

  movesFrom(sq: number): Move[] {
    return this.legalMoves().filter((m) => m.from === sq);
  }

  /** Plays a move given as from/to (+promotion). Returns it, or null if illegal. */
  move(from: number, to: number, promotion?: PromoType): Move | null {
    const legal = this.legalMoves();
    // A promotion without a chosen piece defaults to a queen.
    const m = legal.find(
      (x) => x.from === from && x.to === to && (!x.promotion || x.promotion === (promotion ?? "q")),
    );
    if (!m) return null;
    this.sans.push(toSan(this.pos, m, legal));
    this.moves.push(m);
    const next = applyMove(this.pos, m);
    this.positions.push(next);
    this.keys.push(repetitionKey(next));
    return m;
  }

  moveUci(uci: string): Move | null {
    const from = parseSquare(uci.slice(0, 2));
    const to = parseSquare(uci.slice(2, 4));
    const promo = uci[4] as PromoType | undefined;
    if (from < 0 || to < 0) return null;
    return this.move(from, to, promo);
  }

  undo(): Move | undefined {
    if (!this.moves.length) return undefined;
    this.positions.pop();
    this.keys.pop();
    this.sans.pop();
    return this.moves.pop();
  }

  repetitions(): number {
    const key = this.keys[this.keys.length - 1];
    return this.keys.filter((k) => k === key).length;
  }

  status(): Status {
    const pos = this.pos;
    const check = inCheck(pos);
    const any = legalMoves(pos).length > 0;
    if (!any) {
      return check
        ? { over: true, check, reason: "checkmate", winner: opp(pos.turn) }
        : { over: true, check, reason: "stalemate", winner: null };
    }
    if (pos.halfmove >= 100) return { over: true, check, reason: "fifty-move", winner: null };
    if (this.repetitions() >= 3) return { over: true, check, reason: "threefold", winner: null };
    return { over: false, check };
  }
}

export function resultText(s: Status): string {
  if (!s.over) return "";
  const side = (c: Color) => (c === "w" ? "White" : "Black");
  switch (s.reason) {
    case "checkmate":
      return `Checkmate — ${side(s.winner!)} wins`;
    case "stalemate":
      return "Stalemate — draw";
    case "threefold":
      return "Draw by threefold repetition";
    case "fifty-move":
      return "Draw by the 50-move rule";
  }
}

/** True if the side to move can force checkmate within `n` of its own moves. */
export function forcesMate(pos: Position, n: number): boolean {
  if (n <= 0) return false;
  for (const m of legalMoves(pos)) {
    const next = applyMove(pos, m);
    const replies = legalMoves(next);
    if (replies.length === 0) {
      if (inCheck(next)) return true;
      continue;
    }
    if (n > 1 && replies.every((r) => forcesMate(applyMove(next, r), n - 1))) return true;
  }
  return false;
}

/** True if, after `pos`, the side that just moved can mate within `n` more moves
 *  against every defence (i.e. it's the defender's turn). */
export function defenderLost(pos: Position, n: number): boolean {
  const replies = legalMoves(pos);
  if (replies.length === 0) return inCheck(pos);
  if (n <= 0) return false;
  return replies.every((r) => forcesMate(applyMove(pos, r), n));
}
