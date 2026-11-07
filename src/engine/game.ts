import type { Color, GameStatus, Move, Piece, Square } from "./types.ts";
import { START_FEN, parseFen, sqIndex, sqName, toFen, toPiece } from "./board.ts";
import type { Position } from "./board.ts";
import { findKing, inCheck, legalMoves, makeMove, unmakeMove } from "./movegen.ts";
import type { IMove, Undo } from "./movegen.ts";

export { START_FEN };

type Promo = "q" | "r" | "b" | "n";

interface Entry {
  im: IMove;
  undo: Undo;
  move: Move;
}

function toMove(m: IMove): Move {
  const flags: Move["flags"] = {};
  if (m.ep) flags.enPassant = true;
  if (m.castle) flags.castle = m.castle;
  if (m.dbl) flags.doublePush = true;
  const out: Move = { from: sqName(m.from), to: sqName(m.to), piece: m.piece.toLowerCase() as Move["piece"], flags };
  if (m.cap) out.captured = m.cap.toLowerCase() as Move["piece"];
  if (m.promo) out.promotion = m.promo as Promo;
  return out;
}

export function isValidFen(fen: string): boolean {
  try {
    const pos = parseFen(fen);
    // side not to move must not be in check
    return !inCheck(pos, pos.turn === "w" ? "b" : "w");
  } catch {
    return false;
  }
}

export class Game {
  private pos: Position;
  private stack: Entry[] = [];
  private keys: string[] = [];

  constructor(fen: string = START_FEN) {
    if (!isValidFen(fen)) throw new Error(`Invalid FEN: ${fen}`);
    this.pos = parseFen(fen);
    this.keys.push(this.key());
  }

  private key(): string {
    const p = this.pos;
    const f = toFen({ ...p, ep: -1, half: 0, full: 0 }).split(" ");
    let ep = "-";
    if (p.ep >= 0 && legalMoves(p).some((m) => m.ep)) ep = sqName(p.ep);
    return `${f[0]} ${f[1]} ${f[2]} ${ep}`;
  }

  fen(): string {
    return toFen(this.pos);
  }

  turn(): Color {
    return this.pos.turn;
  }

  board(): (Piece | null)[][] {
    const rows: (Piece | null)[][] = [];
    for (let r = 0; r < 8; r++) rows.push(this.pos.sq.slice(r * 8, r * 8 + 8).map(toPiece));
    return rows;
  }

  get(sq: Square): Piece | null {
    const i = sqIndex(sq);
    return i < 0 ? null : toPiece(this.pos.sq[i]);
  }

  legalMoves(from?: Square): Move[] {
    let all = legalMoves(this.pos);
    if (from !== undefined) {
      const i = sqIndex(from);
      all = all.filter((m) => m.from === i);
    }
    return all.map(toMove);
  }

  move(m: { from: Square; to: Square; promotion?: Promo }): Move | null {
    if (!m) return null;
    const from = sqIndex(m.from);
    const to = sqIndex(m.to);
    if (from < 0 || to < 0) return null;
    const promo = m.promotion ?? "";
    const all = legalMoves(this.pos);
    const im = all.find((x) => x.from === from && x.to === to && x.promo === promo);
    if (!im) return null;
    const move = toMove(im);
    move.san = this.san(im, all);
    const undo = makeMove(this.pos, im);
    this.stack.push({ im, undo, move });
    this.keys.push(this.key());
    if (inCheck(this.pos, this.pos.turn)) move.san += legalMoves(this.pos).length === 0 ? "#" : "+";
    return move;
  }

  private san(m: IMove, all: IMove[]): string {
    if (m.castle) return m.castle === "k" ? "O-O" : "O-O-O";
    const t = m.piece.toLowerCase();
    let s = "";
    if (t === "p") {
      if (m.cap) s += sqName(m.from)[0] + "x";
    } else {
      s += t.toUpperCase();
      const others = all.filter((x) => x.piece === m.piece && x.to === m.to && x.from !== m.from);
      if (others.length) {
        const sameFile = others.some((x) => (x.from & 7) === (m.from & 7));
        const sameRank = others.some((x) => x.from >> 3 === m.from >> 3);
        if (!sameFile) s += sqName(m.from)[0];
        else if (!sameRank) s += sqName(m.from)[1];
        else s += sqName(m.from);
      }
      if (m.cap) s += "x";
    }
    s += sqName(m.to);
    if (m.promo) s += "=" + m.promo.toUpperCase();
    return s;
  }

  moveUci(uci: string): Move | null {
    if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
    const promotion = uci.length === 5 ? (uci[4] as Promo) : undefined;
    return this.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion });
  }

  undo(): Move | null {
    const e = this.stack.pop();
    if (!e) return null;
    this.keys.pop();
    unmakeMove(this.pos, e.im, e.undo);
    return e.move;
  }

  inCheck(): boolean {
    return inCheck(this.pos, this.pos.turn);
  }

  kingSquare(c: Color): Square {
    return sqName(findKing(this.pos, c));
  }

  status(): GameStatus {
    const check = this.inCheck();
    if (legalMoves(this.pos).length === 0) {
      return check ? { state: "checkmate", winner: this.pos.turn === "w" ? "b" : "w" } : { state: "stalemate" };
    }
    const cur = this.keys[this.keys.length - 1];
    if (this.keys.filter((k) => k === cur).length >= 3) return { state: "draw", reason: "threefold" };
    if (this.pos.half >= 100) return { state: "draw", reason: "fifty-move" };
    return { state: "playing", check };
  }

  isGameOver(): boolean {
    return this.status().state !== "playing";
  }

  history(): Move[] {
    return this.stack.map((e) => e.move);
  }

  lastMove(): Move | null {
    return this.stack.length ? this.stack[this.stack.length - 1].move : null;
  }
}
