export type Color = "w" | "b";
export type Kind = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Color}${Kind}`;
export type Board = (Piece | null)[];

export interface State {
  board: Board; // index = rank * 8 + file, a1 = 0
  turn: Color;
  castling: string; // subset of "KQkq"
  ep: number; // en passant target square index, or -1
  half: number;
  full: number;
}

export interface Move {
  from: number;
  to: number;
  promo?: "q" | "r" | "b" | "n";
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const sqName = (i: number) => "abcdefgh"[i & 7] + ((i >> 3) + 1);
export const sqIndex = (s: string) => "abcdefgh".indexOf(s[0]) + (Number(s[1]) - 1) * 8;

export function parseFen(fen: string): State {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error("FEN needs at least 4 fields");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("FEN needs 8 ranks");
  const board: Board = new Array(64).fill(null);
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) f += Number(ch);
      else if (/[pnbrqkPNBRQK]/.test(ch)) {
        if (f > 7) throw new Error("rank too long");
        const color: Color = ch === ch.toUpperCase() ? "w" : "b";
        board[(7 - r) * 8 + f++] = (color + ch.toUpperCase()) as Piece;
      } else throw new Error("bad FEN character");
    }
    if (f !== 8) throw new Error("rank must have 8 files");
  });
  const turn = parts[1];
  if (turn !== "w" && turn !== "b") throw new Error("bad side to move");
  const kings = (c: Color) => board.filter((p) => p === c + "K").length;
  if (kings("w") !== 1 || kings("b") !== 1) throw new Error("each side needs one king");
  const castling = parts[2] === "-" ? "" : parts[2];
  if (!/^[KQkq]*$/.test(castling)) throw new Error("bad castling field");
  if (parts[3] !== "-" && !/^[a-h][36]$/.test(parts[3])) throw new Error("bad en passant square");
  const ep = parts[3] === "-" ? -1 : sqIndex(parts[3]);
  const s: State = {
    board,
    turn,
    castling: sanitizeCastling(board, castling),
    ep,
    half: Number(parts[4] ?? 0) || 0,
    full: Number(parts[5] ?? 1) || 1,
  };
  // The side not to move must not be in check.
  if (inCheck(s.board, s.turn === "w" ? "b" : "w")) throw new Error("side not to move is in check");
  return s;
}

function sanitizeCastling(board: Board, c: string): string {
  let out = "";
  const ok = (k: string, kingSq: number, rookSq: number, col: Color) =>
    c.includes(k) && board[kingSq] === col + "K" && board[rookSq] === col + "R";
  if (ok("K", 4, 7, "w")) out += "K";
  if (ok("Q", 4, 0, "w")) out += "Q";
  if (ok("k", 60, 63, "b")) out += "k";
  if (ok("q", 60, 56, "b")) out += "q";
  return out;
}

export function toFen(s: State): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[r * 8 + f];
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p[0] === "w" ? p[1] : p[1].toLowerCase();
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${s.turn} ${s.castling || "-"} ${s.ep < 0 ? "-" : sqName(s.ep)} ${s.half} ${s.full}`;
}

const KNIGHT = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function isAttacked(board: Board, sq: number, by: Color): boolean {
  const f = sq & 7, r = sq >> 3;
  const at = (ff: number, rr: number) =>
    ff < 0 || ff > 7 || rr < 0 || rr > 7 ? null : board[rr * 8 + ff];
  const pr = by === "w" ? r - 1 : r + 1;
  for (const df of [-1, 1]) if (at(f + df, pr) === by + "P") return true;
  for (const [df, dr] of KNIGHT) if (at(f + df, r + dr) === by + "N") return true;
  for (const [df, dr] of KING) if (at(f + df, r + dr) === by + "K") return true;
  const ray = (dirs: number[][], a: Kind) => {
    for (const [df, dr] of dirs) {
      let ff = f + df, rr = r + dr;
      while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
        const p = board[rr * 8 + ff];
        if (p) {
          if (p === by + a || p === by + "Q") return true;
          break;
        }
        ff += df;
        rr += dr;
      }
    }
    return false;
  };
  return ray(DIAG, "B") || ray(ORTH, "R");
}

export function kingSquare(board: Board, c: Color): number {
  return board.indexOf((c + "K") as Piece);
}

export function inCheck(board: Board, c: Color): boolean {
  return isAttacked(board, kingSquare(board, c), c === "w" ? "b" : "w");
}

function pseudoMoves(s: State): Move[] {
  const { board, turn } = s;
  const enemy: Color = turn === "w" ? "b" : "w";
  const out: Move[] = [];
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p[0] !== turn) continue;
    const f = from & 7, r = from >> 3;
    const kind = p[1] as Kind;
    const push = (to: number) => out.push({ from, to });
    if (kind === "P") {
      const dir = turn === "w" ? 1 : -1;
      const startRank = turn === "w" ? 1 : 6;
      const lastRank = turn === "w" ? 7 : 0;
      const add = (to: number) => {
        if (to >> 3 === lastRank) for (const promo of ["q", "r", "b", "n"] as const) out.push({ from, to, promo });
        else push(to);
      };
      const one = from + dir * 8;
      if (!board[one]) {
        add(one);
        if (r === startRank && !board[one + dir * 8]) push(one + dir * 8);
      }
      for (const df of [-1, 1]) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        const to = one + df;
        if (board[to]?.[0] === enemy) add(to);
        else if (to === s.ep && !board[to]) push(to);
      }
    } else if (kind === "N" || kind === "K") {
      for (const [df, dr] of kind === "N" ? KNIGHT : KING) {
        const ff = f + df, rr = r + dr;
        if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue;
        const to = rr * 8 + ff;
        if (board[to]?.[0] !== turn) push(to);
      }
      if (kind === "K") {
        const base = turn === "w" ? 0 : 56;
        if (from === base + 4 && !isAttacked(board, from, enemy)) {
          const K = turn === "w" ? "K" : "k", Q = turn === "w" ? "Q" : "q";
          if (
            s.castling.includes(K) && !board[base + 5] && !board[base + 6] &&
            !isAttacked(board, base + 5, enemy) && !isAttacked(board, base + 6, enemy)
          ) push(base + 6);
          if (
            s.castling.includes(Q) && !board[base + 1] && !board[base + 2] && !board[base + 3] &&
            !isAttacked(board, base + 3, enemy) && !isAttacked(board, base + 2, enemy)
          ) push(base + 2);
        }
      }
    } else {
      const dirs = kind === "B" ? DIAG : kind === "R" ? ORTH : [...DIAG, ...ORTH];
      for (const [df, dr] of dirs) {
        let ff = f + df, rr = r + dr;
        while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
          const to = rr * 8 + ff;
          const t = board[to];
          if (t?.[0] === turn) break;
          push(to);
          if (t) break;
          ff += df;
          rr += dr;
        }
      }
    }
  }
  return out;
}

/** Applies a move without checking legality. */
export function applyMove(s: State, m: Move): State {
  const board = s.board.slice();
  const p = board[m.from]!;
  const kind = p[1];
  const capture = board[m.to] !== null;
  let ep = -1;
  board[m.from] = null;
  if (kind === "P") {
    if (m.to === s.ep && !capture && (m.from & 7) !== (m.to & 7)) board[m.to + (s.turn === "w" ? -8 : 8)] = null;
    if (Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2;
  }
  board[m.to] = m.promo ? ((s.turn + m.promo.toUpperCase()) as Piece) : p;
  if (kind === "K" && Math.abs(m.to - m.from) === 2) {
    const base = m.from & ~7;
    if (m.to > m.from) {
      board[base + 5] = board[base + 7];
      board[base + 7] = null;
    } else {
      board[base + 3] = board[base];
      board[base] = null;
    }
  }
  let castling = s.castling;
  const strip = (sq: number) => {
    const map: Record<number, string> = { 4: "KQ", 0: "Q", 7: "K", 60: "kq", 56: "q", 63: "k" };
    if (map[sq]) for (const c of map[sq]) castling = castling.replace(c, "");
  };
  strip(m.from);
  strip(m.to);
  return {
    board,
    turn: s.turn === "w" ? "b" : "w",
    castling,
    ep,
    half: kind === "P" || capture ? 0 : s.half + 1,
    full: s.full + (s.turn === "b" ? 1 : 0),
  };
}

export function legalMoves(s: State): Move[] {
  return pseudoMoves(s).filter((m) => !inCheck(applyMove(s, m).board, s.turn));
}

export function perft(s: State, depth: number): number {
  const moves = legalMoves(s);
  if (depth <= 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(s, m), depth - 1);
  return n;
}

export function uci(m: Move): string {
  return sqName(m.from) + sqName(m.to) + (m.promo ?? "");
}

export function parseUci(u: string): Move {
  return { from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), promo: (u[4] as Move["promo"]) || undefined };
}

export type Result =
  | { kind: "checkmate"; winner: Color }
  | { kind: "stalemate" }
  | { kind: "repetition" }
  | { kind: "fifty" }
  | { kind: "insufficient" };

export function resultText(r: Result): string {
  switch (r.kind) {
    case "checkmate":
      return `Checkmate — ${r.winner === "w" ? "White" : "Black"} wins`;
    case "stalemate":
      return "Stalemate — draw";
    case "repetition":
      return "Draw by threefold repetition";
    case "fifty":
      return "Draw by the 50-move rule";
    case "insufficient":
      return "Draw — insufficient material";
  }
}

/** Key for repetition: placement, side, castling, and en passant only if capturable. */
export function positionKey(s: State): string {
  const fen = toFen({ ...s, ep: -1, half: 0, full: 1 }).split(" ");
  let ep = "-";
  if (s.ep >= 0 && legalMoves(s).some((m) => m.to === s.ep && s.board[m.from]![1] === "P")) ep = sqName(s.ep);
  return `${fen[0]} ${fen[1]} ${fen[2]} ${ep}`;
}

function insufficient(board: Board): boolean {
  const rest = board.filter((p) => p && p[1] !== "K") as Piece[];
  if (rest.length === 0) return true;
  return rest.length === 1 && (rest[0][1] === "B" || rest[0][1] === "N");
}

export function evaluate(s: State, keys: string[]): Result | null {
  const moves = legalMoves(s);
  if (moves.length === 0) {
    return inCheck(s.board, s.turn) ? { kind: "checkmate", winner: s.turn === "w" ? "b" : "w" } : { kind: "stalemate" };
  }
  if (insufficient(s.board)) return { kind: "insufficient" };
  const key = positionKey(s);
  if (keys.filter((k) => k === key).length >= 3) return { kind: "repetition" };
  if (s.half >= 100) return { kind: "fifty" };
  return null;
}

/** A game with history, undo and automatic result detection. */
export class Game {
  states: State[];
  moves: Move[] = [];
  keys: string[];
  result: Result | null;

  constructor(fen: string = START_FEN) {
    const s = parseFen(fen);
    this.states = [s];
    this.keys = [positionKey(s)];
    this.result = evaluate(s, this.keys);
  }
  get state(): State {
    return this.states[this.states.length - 1];
  }
  get lastMove(): Move | null {
    return this.moves[this.moves.length - 1] ?? null;
  }
  legal(): Move[] {
    return this.result ? [] : legalMoves(this.state);
  }
  /** Plays a move if legal. Returns false otherwise. */
  play(m: Move): boolean {
    const found = this.legal().find((x) => x.from === m.from && x.to === m.to && x.promo === m.promo);
    if (!found) return false;
    const next = applyMove(this.state, found);
    this.states.push(next);
    this.moves.push(found);
    this.keys.push(positionKey(next));
    this.result = evaluate(next, this.keys);
    return true;
  }
  undo(): boolean {
    if (this.moves.length === 0) return false;
    this.states.pop();
    this.moves.pop();
    this.keys.pop();
    this.result = evaluate(this.state, this.keys);
    return true;
  }
}
