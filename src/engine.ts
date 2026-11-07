// Chess rules engine: board state, legal move generation, game status.
export type Color = "w" | "b";
export type Kind = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Color}${Kind}`;
export type Promo = "q" | "r" | "b" | "n";
export type Board = (Piece | null)[];

export interface Move {
  from: number;
  to: number;
  promo?: Promo;
}

export interface Position {
  board: Board;
  turn: Color;
  /** castling rights: K Q k q */
  castling: string;
  /** en passant target square index, or -1 */
  ep: number;
  halfmove: number;
  fullmove: number;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** index = rank * 8 + file, a1 = 0, h8 = 63 */
export const sqName = (i: number) => "abcdefgh"[i % 8] + (Math.floor(i / 8) + 1);
export const sqIndex = (n: string) => "abcdefgh".indexOf(n[0]) + (Number(n[1]) - 1) * 8;

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error("FEN needs at least 4 fields");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("FEN needs 8 ranks");
  const board: Board = new Array(64).fill(null);
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) file += Number(ch);
      else {
        if (!/[pnbrqkPNBRQK]/.test(ch) || file > 7) throw new Error("Bad FEN piece row");
        const color: Color = ch === ch.toUpperCase() ? "w" : "b";
        board[rank * 8 + file] = (color + ch.toUpperCase()) as Piece;
        file++;
      }
    }
    if (file !== 8) throw new Error("FEN rank must have 8 files");
  });
  if (parts[1] !== "w" && parts[1] !== "b") throw new Error("Bad side to move");
  const kings = (c: Color) => board.filter((p) => p === c + "K").length;
  if (kings("w") !== 1 || kings("b") !== 1) throw new Error("Each side needs exactly one king");
  const castling = parts[2] === "-" ? "" : parts[2];
  if (!/^[KQkq]*$/.test(castling)) throw new Error("Bad castling field");
  const ep = parts[3] === "-" ? -1 : sqIndex(parts[3]);
  if (ep < -1 || ep > 63 || Number.isNaN(ep)) throw new Error("Bad en passant square");
  return {
    board,
    turn: parts[1],
    castling,
    ep,
    halfmove: Number(parts[4] ?? 0) || 0,
    fullmove: Number(parts[5] ?? 1) || 1,
  };
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
  return `${rows.join("/")} ${p.turn} ${p.castling || "-"} ${p.ep < 0 ? "-" : sqName(p.ep)} ${p.halfmove} ${p.fullmove}`;
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const other = (c: Color): Color => (c === "w" ? "b" : "w");

/** Is square `sq` attacked by any piece of colour `by`? */
export function isAttacked(board: Board, sq: number, by: Color): boolean {
  const r = Math.floor(sq / 8);
  const f = sq % 8;
  const at = (rr: number, ff: number) =>
    rr >= 0 && rr < 8 && ff >= 0 && ff < 8 ? board[rr * 8 + ff] : null;
  const pr = by === "w" ? r - 1 : r + 1;
  for (const df of [-1, 1]) if (at(pr, f + df) === by + "P") return true;
  for (const [dr, df] of KNIGHT) if (at(r + dr, f + df) === by + "N") return true;
  for (const [dr, df] of KING) if (at(r + dr, f + df) === by + "K") return true;
  const slide = (dirs: number[][], a: Kind) => {
    for (const [dr, df] of dirs) {
      let rr = r + dr;
      let ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const p = board[rr * 8 + ff];
        if (p) {
          if (p === by + a || p === by + "Q") return true;
          break;
        }
        rr += dr;
        ff += df;
      }
    }
    return false;
  };
  return slide(DIAG, "B") || slide(ORTHO, "R");
}

export function kingSquare(board: Board, c: Color): number {
  return board.indexOf((c + "K") as Piece);
}

export function inCheck(p: Position, c: Color = p.turn): boolean {
  return isAttacked(p.board, kingSquare(p.board, c), other(c));
}

const PROMOS: Promo[] = ["q", "r", "b", "n"];

function pseudoMoves(p: Position): Move[] {
  const { board, turn } = p;
  const moves: Move[] = [];
  const foe = other(turn);
  const add = (from: number, to: number) => moves.push({ from, to });
  for (let from = 0; from < 64; from++) {
    const pc = board[from];
    if (!pc || pc[0] !== turn) continue;
    const r = Math.floor(from / 8);
    const f = from % 8;
    const kind = pc[1] as Kind;
    if (kind === "P") {
      const dir = turn === "w" ? 1 : -1;
      const startRank = turn === "w" ? 1 : 6;
      const lastRank = turn === "w" ? 7 : 0;
      const push = (to: number) => {
        if (Math.floor(to / 8) === lastRank) for (const promo of PROMOS) moves.push({ from, to, promo });
        else add(from, to);
      };
      const one = from + dir * 8;
      if (!board[one]) {
        push(one);
        if (r === startRank && !board[one + dir * 8]) add(from, one + dir * 8);
      }
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const to = one + df;
        const target = board[to];
        if (target && target[0] === foe) push(to);
        else if (!target && to === p.ep) add(from, to);
      }
    } else if (kind === "N" || kind === "K") {
      for (const [dr, df] of kind === "N" ? KNIGHT : KING) {
        const rr = r + dr;
        const ff = f + df;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
        const t = board[rr * 8 + ff];
        if (!t || t[0] === foe) add(from, rr * 8 + ff);
      }
      if (kind === "K") castleMoves(p, from, moves);
    } else {
      const dirs = kind === "B" ? DIAG : kind === "R" ? ORTHO : [...DIAG, ...ORTHO];
      for (const [dr, df] of dirs) {
        let rr = r + dr;
        let ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const t = board[rr * 8 + ff];
          if (!t) add(from, rr * 8 + ff);
          else {
            if (t[0] === foe) add(from, rr * 8 + ff);
            break;
          }
          rr += dr;
          ff += df;
        }
      }
    }
  }
  return moves;
}

function castleMoves(p: Position, from: number, moves: Move[]) {
  const { board, turn } = p;
  const home = turn === "w" ? 4 : 60;
  if (from !== home) return;
  const foe = other(turn);
  if (isAttacked(board, home, foe)) return;
  const rook = (turn + "R") as Piece;
  // king side
  if (p.castling.includes(turn === "w" ? "K" : "k") && board[home + 3] === rook &&
      !board[home + 1] && !board[home + 2] &&
      !isAttacked(board, home + 1, foe) && !isAttacked(board, home + 2, foe)) {
    moves.push({ from, to: home + 2 });
  }
  // queen side
  if (p.castling.includes(turn === "w" ? "Q" : "q") && board[home - 4] === rook &&
      !board[home - 1] && !board[home - 2] && !board[home - 3] &&
      !isAttacked(board, home - 1, foe) && !isAttacked(board, home - 2, foe)) {
    moves.push({ from, to: home - 2 });
  }
}

/** Apply a (pseudo-legal) move; returns a new position. */
export function applyMove(p: Position, m: Move): Position {
  const board = p.board.slice();
  const pc = board[m.from]!;
  const kind = pc[1] as Kind;
  const captured = board[m.to];
  let ep = -1;
  board[m.from] = null;
  board[m.to] = m.promo ? ((p.turn + m.promo.toUpperCase()) as Piece) : pc;
  if (kind === "P") {
    if (m.to === p.ep && !captured && m.from % 8 !== m.to % 8) {
      board[m.to + (p.turn === "w" ? -8 : 8)] = null; // en passant capture
    }
    if (Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2;
  }
  if (kind === "K" && Math.abs(m.to - m.from) === 2) {
    const rank = m.from - (m.from % 8);
    if (m.to > m.from) {
      board[rank + 5] = board[rank + 7];
      board[rank + 7] = null;
    } else {
      board[rank + 3] = board[rank];
      board[rank] = null;
    }
  }
  let castling = p.castling;
  if (kind === "K") castling = castling.replace(p.turn === "w" ? /[KQ]/g : /[kq]/g, "");
  const strip: Record<number, string> = { 0: "Q", 7: "K", 56: "q", 63: "k" };
  for (const sq of [m.from, m.to]) if (strip[sq]) castling = castling.replace(strip[sq], "");
  return {
    board,
    turn: other(p.turn),
    castling,
    ep,
    halfmove: kind === "P" || captured ? 0 : p.halfmove + 1,
    fullmove: p.fullmove + (p.turn === "b" ? 1 : 0),
  };
}

export function legalMoves(p: Position): Move[] {
  return pseudoMoves(p).filter((m) => {
    const next = applyMove(p, m);
    return !isAttacked(next.board, kingSquare(next.board, p.turn), next.turn);
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

export const uci = (m: Move) => sqName(m.from) + sqName(m.to) + (m.promo ?? "");

// ---------------------------------------------------------------- game

export type Result =
  | { kind: "checkmate"; winner: Color }
  | { kind: "stalemate" }
  | { kind: "threefold" }
  | { kind: "fifty" }
  | { kind: "insufficient" };

export interface Game {
  position: Position;
  /** repetition keys of every position reached so far, including the current one */
  keys: string[];
  last: Move | null;
  result: Result | null;
}

/** Position identity for repetition: placement, side, castling, and ep only if capturable. */
export function positionKey(p: Position): string {
  const fen = toFen(p).split(" ");
  const epUsable = p.ep >= 0 && legalMoves(p).some((m) => m.to === p.ep && p.board[m.from]![1] === "P");
  return [fen[0], fen[1], fen[2], epUsable ? fen[3] : "-"].join(" ");
}

function insufficient(board: Board): boolean {
  const rest = board.filter((x) => x && x[1] !== "K") as Piece[];
  if (rest.length === 0) return true;
  if (rest.length === 1) return rest[0][1] === "B" || rest[0][1] === "N";
  return false;
}

export function evaluate(g: { position: Position; keys: string[] }): Result | null {
  const p = g.position;
  if (legalMoves(p).length === 0) {
    return inCheck(p) ? { kind: "checkmate", winner: other(p.turn) } : { kind: "stalemate" };
  }
  const key = g.keys[g.keys.length - 1];
  if (g.keys.filter((k) => k === key).length >= 3) return { kind: "threefold" };
  if (p.halfmove >= 100) return { kind: "fifty" };
  if (insufficient(p.board)) return { kind: "insufficient" };
  return null;
}

export function newGame(fen: string = START_FEN): Game {
  const position = parseFen(fen);
  const g = { position, keys: [positionKey(position)], last: null, result: null as Result | null };
  g.result = evaluate(g);
  return g;
}

/** Play a legal move; returns the new game, or null if the move is illegal / game over. */
export function play(g: Game, m: Move): Game | null {
  if (g.result) return null;
  const legal = legalMoves(g.position).find(
    (l) => l.from === m.from && l.to === m.to && l.promo === m.promo,
  );
  if (!legal) return null;
  const position = applyMove(g.position, legal);
  const next: Game = { position, keys: [...g.keys, positionKey(position)], last: legal, result: null };
  next.result = evaluate(next);
  return next;
}

export function resultText(r: Result): string {
  switch (r.kind) {
    case "checkmate": return `Checkmate — ${r.winner === "w" ? "White" : "Black"} wins`;
    case "stalemate": return "Stalemate — draw";
    case "threefold": return "Draw by threefold repetition";
    case "fifty": return "Draw by the 50-move rule";
    case "insufficient": return "Draw — insufficient material";
  }
}
