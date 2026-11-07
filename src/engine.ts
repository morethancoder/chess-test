export type Color = "w" | "b";
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Color}${PieceType}`;
export type PromoType = "q" | "r" | "b" | "n";

export interface Position {
  board: (Piece | null)[]; // index = rank*8 + file; a1 = 0, h8 = 63
  turn: Color;
  castling: string; // subset of "KQkq", or ""
  ep: number; // en passant target square index or -1
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  promo?: PromoType;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const sq = (name: string): number => name.charCodeAt(0) - 97 + (name.charCodeAt(1) - 49) * 8;
export const sqName = (i: number): string => String.fromCharCode(97 + (i & 7)) + String.fromCharCode(49 + (i >> 3));

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error("Invalid FEN: needs at least 4 fields");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("Invalid FEN: need 8 ranks");
  const board: (Piece | null)[] = new Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/[1-8]/.test(ch)) f += Number(ch);
      else if (/[pnbrqkPNBRQK]/.test(ch)) {
        if (f > 7) throw new Error("Invalid FEN: rank too long");
        const color: Color = ch === ch.toUpperCase() ? "w" : "b";
        board[(7 - r) * 8 + f] = (color + ch.toUpperCase()) as Piece;
        f++;
      } else throw new Error("Invalid FEN: bad character");
    }
    if (f !== 8) throw new Error("Invalid FEN: rank length");
  }
  if (parts[1] !== "w" && parts[1] !== "b") throw new Error("Invalid FEN: side to move");
  const count = (p: Piece) => board.filter((x) => x === p).length;
  if (count("wK") !== 1 || count("bK") !== 1) throw new Error("Invalid FEN: need one king each");
  let castling = parts[2] === "-" ? "" : parts[2];
  if (!/^[KQkq]*$/.test(castling)) throw new Error("Invalid FEN: castling");
  // drop castling rights that are impossible given the board
  castling = [...castling]
    .filter((c) => {
      const white = c === c.toUpperCase();
      const king = white ? "e1" : "e8";
      const rook = c.toUpperCase() === "K" ? (white ? "h1" : "h8") : white ? "a1" : "a8";
      return board[sq(king)] === (white ? "wK" : "bK") && board[sq(rook)] === (white ? "wR" : "bR");
    })
    .join("");
  const ep = parts[3] === "-" ? -1 : /^[a-h][36]$/.test(parts[3]) ? sq(parts[3]) : NaN;
  if (Number.isNaN(ep)) throw new Error("Invalid FEN: en passant");
  const pos: Position = {
    board,
    turn: parts[1] as Color,
    castling,
    ep,
    halfmove: Number(parts[4] ?? 0) || 0,
    fullmove: Number(parts[5] ?? 1) || 1,
  };
  // the side that just moved must not have left its king attacked
  if (isAttacked(board, findKing(board, other(pos.turn)), pos.turn)) throw new Error("Invalid FEN: side not to move is in check");
  return pos;
}

export function toFen(p: Position): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
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
  return rows.join("/") + " " + p.turn + " " + (p.castling || "-") + " " + (p.ep < 0 ? "-" : sqName(p.ep)) + " " + p.halfmove + " " + p.fullmove;
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function isAttacked(board: (Piece | null)[], target: number, by: Color): boolean {
  const tf = target & 7;
  const tr = target >> 3;
  const at = (f: number, r: number): Piece | null => (f < 0 || f > 7 || r < 0 || r > 7 ? null : board[r * 8 + f]);
  const pawn = (by + "P") as Piece;
  const pr = by === "w" ? tr - 1 : tr + 1; // a white pawn attacks upward, so it sits below the target
  if (at(tf - 1, pr) === pawn || at(tf + 1, pr) === pawn) return true;
  for (const [df, dr] of KNIGHT) if (at(tf + df, tr + dr) === by + "N") return true;
  for (const [df, dr] of KING) if (at(tf + df, tr + dr) === by + "K") return true;
  const lines: [number[][], string][] = [[DIAG, "B"], [ORTH, "R"]];
  for (const [dirs, slider] of lines) {
    for (const [df, dr] of dirs) {
      let f = tf + df;
      let r = tr + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const pc = board[r * 8 + f];
        if (pc) {
          if (pc[0] === by && (pc[1] === slider || pc[1] === "Q")) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
  }
  return false;
}

export const other = (c: Color): Color => (c === "w" ? "b" : "w");

export function findKing(board: (Piece | null)[], c: Color): number {
  return board.indexOf((c + "K") as Piece);
}

export function inCheck(p: Position, c: Color = p.turn): boolean {
  return isAttacked(p.board, findKing(p.board, c), other(c));
}

function pseudoMoves(p: Position): Move[] {
  const out: Move[] = [];
  const us = p.turn;
  const them = other(us);
  const b = p.board;
  for (let from = 0; from < 64; from++) {
    const pc = b[from];
    if (!pc || pc[0] !== us) continue;
    const f = from & 7;
    const r = from >> 3;
    const type = pc[1];
    if (type === "P") {
      const dir = us === "w" ? 1 : -1;
      const startRank = us === "w" ? 1 : 6;
      const lastRank = us === "w" ? 7 : 0;
      const push = (to: number) => {
        if (to >> 3 === lastRank) for (const promo of ["q", "r", "b", "n"] as const) out.push({ from, to, promo });
        else out.push({ from, to });
      };
      const one = from + dir * 8;
      if (one >= 0 && one < 64 && !b[one]) {
        push(one);
        if (r === startRank && !b[one + dir * 8]) out.push({ from, to: one + dir * 8 });
      }
      for (const df of [-1, 1]) {
        const nf = f + df;
        if (nf < 0 || nf > 7) continue;
        const to = (r + dir) * 8 + nf;
        if (to < 0 || to > 63) continue;
        const t = b[to];
        if ((t && t[0] === them) || to === p.ep) push(to);
      }
    } else if (type === "N" || type === "K") {
      for (const [df, dr] of type === "N" ? KNIGHT : KING) {
        const nf = f + df;
        const nr = r + dr;
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const t = b[nr * 8 + nf];
        if (!t || t[0] === them) out.push({ from, to: nr * 8 + nf });
      }
      if (type === "K") {
        const home = us === "w" ? 0 : 56;
        if (from === home + 4 && !isAttacked(b, from, them)) {
          const ks = us === "w" ? "K" : "k";
          const qs = us === "w" ? "Q" : "q";
          const rook = (us + "R") as Piece;
          if (
            p.castling.includes(ks) && b[home + 7] === rook && !b[home + 5] && !b[home + 6] &&
            !isAttacked(b, home + 5, them) && !isAttacked(b, home + 6, them)
          ) out.push({ from, to: home + 6 });
          if (
            p.castling.includes(qs) && b[home] === rook && !b[home + 1] && !b[home + 2] && !b[home + 3] &&
            !isAttacked(b, home + 3, them) && !isAttacked(b, home + 2, them)
          ) out.push({ from, to: home + 2 });
        }
      }
    } else {
      const dirs = type === "B" ? DIAG : type === "R" ? ORTH : [...DIAG, ...ORTH];
      for (const [df, dr] of dirs) {
        let nf = f + df;
        let nr = r + dr;
        while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
          const t = b[nr * 8 + nf];
          if (!t) out.push({ from, to: nr * 8 + nf });
          else {
            if (t[0] === them) out.push({ from, to: nr * 8 + nf });
            break;
          }
          nf += df;
          nr += dr;
        }
      }
    }
  }
  return out;
}

/** Plays a move without checking legality. */
export function applyMove(p: Position, m: Move): Position {
  const board = p.board.slice();
  const pc = board[m.from]!;
  const us = p.turn;
  const capture = board[m.to] !== null;
  let ep = -1;
  board[m.from] = null;
  if (pc[1] === "P") {
    if (m.to === p.ep && (m.from & 7) !== (m.to & 7) && !capture) board[m.to + (us === "w" ? -8 : 8)] = null;
    if (Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2;
  }
  board[m.to] = m.promo ? ((us + m.promo.toUpperCase()) as Piece) : pc;
  if (pc[1] === "K" && Math.abs(m.to - m.from) === 2) {
    const home = m.from & ~7;
    if (m.to > m.from) {
      board[home + 5] = board[home + 7];
      board[home + 7] = null;
    } else {
      board[home + 3] = board[home];
      board[home] = null;
    }
  }
  let castling = p.castling;
  const strip = (s: string) => (castling = [...castling].filter((c) => !s.includes(c)).join(""));
  if (pc[1] === "K") strip(us === "w" ? "KQ" : "kq");
  for (const s of [m.from, m.to]) {
    if (s === 0) strip("Q");
    else if (s === 7) strip("K");
    else if (s === 56) strip("q");
    else if (s === 63) strip("k");
  }
  return {
    board,
    turn: other(us),
    castling,
    ep,
    halfmove: pc[1] === "P" || capture ? 0 : p.halfmove + 1,
    fullmove: p.fullmove + (us === "b" ? 1 : 0),
  };
}

export function legalMoves(p: Position): Move[] {
  const us = p.turn;
  return pseudoMoves(p).filter((m) => {
    const n = applyMove(p, m);
    return !isAttacked(n.board, findKing(n.board, us), n.turn);
  });
}

export function perft(p: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(p);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(p, m), depth - 1);
  return n;
}

export function moveToUci(m: Move): string {
  return sqName(m.from) + sqName(m.to) + (m.promo ?? "");
}

export function parseUci(s: string): Move {
  return { from: sq(s.slice(0, 2)), to: sq(s.slice(2, 4)), promo: (s[4] as PromoType | undefined) || undefined };
}

/** Finds the legal move matching from/to (and promo, if given). */
export function findMove(p: Position, from: number, to: number, promo?: PromoType): Move | undefined {
  return legalMoves(p).find((m) => m.from === from && m.to === to && m.promo === promo);
}

/** Key for repetition: placement, side, castling, and en passant only when a capture is legal. */
export function positionKey(p: Position): string {
  let ep = "-";
  if (p.ep >= 0 && legalMoves(p).some((m) => m.to === p.ep && p.board[m.from]![1] === "P")) ep = sqName(p.ep);
  return toFen(p).split(" ").slice(0, 3).join(" ") + " " + ep;
}

export type Outcome =
  | { over: false }
  | { over: true; kind: "checkmate"; winner: Color; text: string }
  | { over: true; kind: "stalemate" | "threefold" | "fifty"; winner: null; text: string };

/** `keys` are the positionKey of every position reached so far, including the current one. */
export function outcome(p: Position, keys: string[]): Outcome {
  const moves = legalMoves(p);
  if (moves.length === 0) {
    if (inCheck(p)) {
      const winner = other(p.turn);
      return { over: true, kind: "checkmate", winner, text: "Checkmate — " + (winner === "w" ? "White" : "Black") + " wins" };
    }
    return { over: true, kind: "stalemate", winner: null, text: "Stalemate — draw" };
  }
  if (p.halfmove >= 100) return { over: true, kind: "fifty", winner: null, text: "Draw by the 50-move rule" };
  const k = positionKey(p);
  if (keys.filter((x) => x === k).length >= 3) {
    return { over: true, kind: "threefold", winner: null, text: "Draw by threefold repetition" };
  }
  return { over: false };
}
