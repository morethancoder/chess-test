// Chess rules: positions, legal move generation, game status.
export type Color = "w" | "b";
export type Kind = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Color}${Kind}`;
export type Promo = "q" | "r" | "b" | "n";

export interface Position {
  board: (Piece | null)[]; // index = rank*8 + file, a1 = 0
  turn: Color;
  castling: string; // subset of "KQkq"
  ep: number; // en passant target square index, or -1
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  promo?: Promo;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const sq = (s: string): number => (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97);
export const name = (i: number): string => String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1);

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) throw new Error("Bad FEN");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("Bad FEN");
  const board: (Piece | null)[] = new Array(64).fill(null);
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) f += Number(ch);
      else if (/[pnbrqkPNBRQK]/.test(ch)) {
        if (f > 7) throw new Error("Bad FEN");
        const colour: Color = ch === ch.toUpperCase() ? "w" : "b";
        board[(7 - r) * 8 + f++] = (colour + ch.toUpperCase()) as Piece;
      } else throw new Error("Bad FEN");
    }
    if (f !== 8) throw new Error("Bad FEN");
  });
  if (parts[1] !== "w" && parts[1] !== "b") throw new Error("Bad FEN");
  const turn: Color = parts[1];
  const kings = (c: Color) => board.filter((p) => p === c + "K").length;
  if (kings("w") !== 1 || kings("b") !== 1) throw new Error("Bad FEN");
  const castling = (parts[2] ?? "-").replace(/[^KQkq]/g, "");
  const ep = parts[3] && /^[a-h][36]$/.test(parts[3]) ? sq(parts[3]) : -1;
  return { board, turn, castling, ep, halfmove: Number(parts[4]) || 0, fullmove: Number(parts[5]) || 1 };
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
  const ep = p.ep >= 0 ? name(p.ep) : "-";
  return rows.join("/") + " " + p.turn + " " + (p.castling || "-") + " " + ep + " " + p.halfmove + " " + p.fullmove;
}

const KNIGHT: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const ORTH: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function isAttacked(board: (Piece | null)[], target: number, by: Color): boolean {
  const tf = target % 8;
  const tr = target >> 3;
  const at = (f: number, r: number) => (f < 0 || f > 7 || r < 0 || r > 7 ? null : board[r * 8 + f]);
  // an attacking pawn sits one rank behind the target, from the attacker's direction
  const pr = by === "w" ? tr - 1 : tr + 1;
  if (at(tf - 1, pr) === by + "P" || at(tf + 1, pr) === by + "P") return true;
  for (const [df, dr] of KNIGHT) if (at(tf + df, tr + dr) === by + "N") return true;
  for (const [df, dr] of KING) if (at(tf + df, tr + dr) === by + "K") return true;
  const rays: [[number, number][], string][] = [[DIAG, "BQ"], [ORTH, "RQ"]];
  for (const [dirs, kinds] of rays) {
    for (const [df, dr] of dirs) {
      let f = tf + df;
      let r = tr + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const pc = board[r * 8 + f];
        if (pc) {
          if (pc[0] === by && kinds.includes(pc[1])) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
  }
  return false;
}

const other = (c: Color): Color => (c === "w" ? "b" : "w");
const kingSquare = (board: (Piece | null)[], c: Color) => board.indexOf((c + "K") as Piece);

export function inCheck(p: Position, c: Color = p.turn): boolean {
  return isAttacked(p.board, kingSquare(p.board, c), other(c));
}

/** Apply a move without checking legality. Handles castling, en passant, promotion. */
export function applyMove(p: Position, m: Move): Position {
  const board = p.board.slice();
  const piece = board[m.from]!;
  const colour = piece[0] as Color;
  const captured = board[m.to];
  board[m.to] = m.promo ? ((colour + m.promo.toUpperCase()) as Piece) : piece;
  board[m.from] = null;
  let ep = -1;
  if (piece[1] === "P") {
    if (m.to === p.ep) board[m.to + (colour === "w" ? -8 : 8)] = null;
    if (Math.abs(m.to - m.from) === 16) ep = (m.to + m.from) / 2;
  }
  if (piece[1] === "K" && Math.abs(m.to - m.from) === 2) {
    const rank = m.from & ~7;
    if (m.to > m.from) {
      board[rank + 5] = board[rank + 7];
      board[rank + 7] = null;
    } else {
      board[rank + 3] = board[rank];
      board[rank] = null;
    }
  }
  let castling = p.castling;
  const strip = (s: string) => {
    for (const ch of s) castling = castling.replace(ch, "");
  };
  if (piece[1] === "K") strip(colour === "w" ? "KQ" : "kq");
  for (const s of [m.from, m.to]) {
    if (s === 0) strip("Q");
    else if (s === 7) strip("K");
    else if (s === 56) strip("q");
    else if (s === 63) strip("k");
  }
  return {
    board,
    turn: other(colour),
    castling,
    ep,
    halfmove: piece[1] === "P" || captured ? 0 : p.halfmove + 1,
    fullmove: p.fullmove + (colour === "b" ? 1 : 0),
  };
}

function pseudoMoves(p: Position): Move[] {
  const out: Move[] = [];
  const { board, turn } = p;
  const add = (from: number, to: number, promo = false) => {
    if (promo) for (const k of ["q", "r", "b", "n"] as const) out.push({ from, to, promo: k });
    else out.push({ from, to });
  };
  for (let from = 0; from < 64; from++) {
    const pc = board[from];
    if (!pc || pc[0] !== turn) continue;
    const f = from % 8;
    const r = from >> 3;
    const kind = pc[1] as Kind;
    if (kind === "P") {
      const dir = turn === "w" ? 1 : -1;
      const startRank = turn === "w" ? 1 : 6;
      const lastRank = turn === "w" ? 7 : 0;
      const r1 = r + dir;
      if (r1 < 0 || r1 > 7) continue;
      if (!board[r1 * 8 + f]) {
        add(from, r1 * 8 + f, r1 === lastRank);
        if (r === startRank && !board[(r + 2 * dir) * 8 + f]) add(from, (r + 2 * dir) * 8 + f);
      }
      for (const df of [-1, 1]) {
        const nf = f + df;
        if (nf < 0 || nf > 7) continue;
        const t = r1 * 8 + nf;
        const tp = board[t];
        if ((tp && tp[0] !== turn) || t === p.ep) add(from, t, r1 === lastRank);
      }
    } else if (kind === "N" || kind === "K") {
      for (const [df, dr] of kind === "N" ? KNIGHT : KING) {
        const nf = f + df;
        const nr = r + dr;
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const tp = board[nr * 8 + nf];
        if (!tp || tp[0] !== turn) add(from, nr * 8 + nf);
      }
    } else {
      const dirs = kind === "B" ? DIAG : kind === "R" ? ORTH : [...DIAG, ...ORTH];
      for (const [df, dr] of dirs) {
        let nf = f + df;
        let nr = r + dr;
        while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
          const tp = board[nr * 8 + nf];
          if (!tp) add(from, nr * 8 + nf);
          else {
            if (tp[0] !== turn) add(from, nr * 8 + nf);
            break;
          }
          nf += df;
          nr += dr;
        }
      }
    }
  }
  // castling: king and rook unmoved (rights), squares empty, king not in/through/into check
  const rank = turn === "w" ? 0 : 56;
  const enemy = other(turn);
  if (board[rank + 4] === turn + "K" && !isAttacked(board, rank + 4, enemy)) {
    const k = turn === "w" ? "K" : "k";
    const q = turn === "w" ? "Q" : "q";
    if (
      p.castling.includes(k) && board[rank + 7] === turn + "R" &&
      !board[rank + 5] && !board[rank + 6] &&
      !isAttacked(board, rank + 5, enemy) && !isAttacked(board, rank + 6, enemy)
    ) out.push({ from: rank + 4, to: rank + 6 });
    if (
      p.castling.includes(q) && board[rank] === turn + "R" &&
      !board[rank + 1] && !board[rank + 2] && !board[rank + 3] &&
      !isAttacked(board, rank + 3, enemy) && !isAttacked(board, rank + 2, enemy)
    ) out.push({ from: rank + 4, to: rank + 2 });
  }
  return out;
}

export function legalMoves(p: Position): Move[] {
  return pseudoMoves(p).filter((m) => {
    const n = applyMove(p, m);
    return !isAttacked(n.board, kingSquare(n.board, p.turn), n.turn);
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

export const toUci = (m: Move): string => name(m.from) + name(m.to) + (m.promo ?? "");

export function parseUci(p: Position, uci: string): Move | undefined {
  return legalMoves(p).find((m) => toUci(m) === uci);
}

/** Repetition key: placement, side, castling, and ep only if an en passant capture is legal. */
export function repetitionKey(p: Position): string {
  const epLegal = p.ep >= 0 && legalMoves(p).some((m) => m.to === p.ep && p.board[m.from]![1] === "P");
  const [placement, turn, castling] = toFen(p).split(" ");
  return placement + " " + turn + " " + castling + " " + (epLegal ? name(p.ep) : "-");
}

export function insufficientMaterial(p: Position): boolean {
  const rest = p.board.filter((x) => x && x[1] !== "K") as Piece[];
  if (rest.length === 0) return true;
  return rest.length === 1 && (rest[0][1] === "N" || rest[0][1] === "B");
}

export type Outcome =
  | { over: false }
  | { over: true; kind: "checkmate"; winner: Color }
  | { over: true; kind: "stalemate" | "threefold" | "fifty-move" | "insufficient" };

/** `keys` holds the repetition keys of every position so far, including the current one. */
export function outcome(p: Position, keys: string[]): Outcome {
  if (legalMoves(p).length === 0) {
    return inCheck(p) ? { over: true, kind: "checkmate", winner: other(p.turn) } : { over: true, kind: "stalemate" };
  }
  if (insufficientMaterial(p)) return { over: true, kind: "insufficient" };
  const key = repetitionKey(p);
  if (keys.filter((k) => k === key).length >= 3) return { over: true, kind: "threefold" };
  if (p.halfmove >= 100) return { over: true, kind: "fifty-move" };
  return { over: false };
}

export function resultText(o: Outcome): string {
  if (!o.over) return "";
  switch (o.kind) {
    case "checkmate": return "Checkmate — " + (o.winner === "w" ? "White" : "Black") + " wins";
    case "stalemate": return "Draw by stalemate";
    case "threefold": return "Draw by threefold repetition";
    case "fifty-move": return "Draw by the 50-move rule";
    case "insufficient": return "Draw by insufficient material";
  }
}
