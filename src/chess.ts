// Chess rules engine: board representation, FEN, legal move generation,
// SAN, perft and game-ending detection. No DOM code here.

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}
export type MoveFlag = "normal" | "double" | "ep" | "castleK" | "castleQ";
export interface Move {
  from: number;
  to: number;
  color: Color;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  flag: MoveFlag;
}
interface Undo {
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
  captured: Piece | null;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FILES = "abcdefgh";
export const squareName = (sq: number): string => FILES[sq & 7] + ((sq >> 3) + 1);
export const fileOf = (sq: number): number => sq & 7;
export const rankOf = (sq: number): number => sq >> 3;
export function parseSquare(name: string): number {
  if (!/^[a-h][1-8]$/.test(name)) return -1;
  return (Number(name[1]) - 1) * 8 + FILES.indexOf(name[0]);
}
export const other = (c: Color): Color => (c === "w" ? "b" : "w");

// Shared immutable piece objects, so moves never allocate pieces.
const PIECES: Record<Color, Record<PieceType, Piece>> = {
  w: { p: { color: "w", type: "p" }, n: { color: "w", type: "n" }, b: { color: "w", type: "b" }, r: { color: "w", type: "r" }, q: { color: "w", type: "q" }, k: { color: "w", type: "k" } },
  b: { p: { color: "b", type: "p" }, n: { color: "b", type: "n" }, b: { color: "b", type: "b" }, r: { color: "b", type: "r" }, q: { color: "b", type: "q" }, k: { color: "b", type: "k" } },
};
export const pieceOf = (color: Color, type: PieceType): Piece => PIECES[color][type];

// Castling rights bits.
const WK = 1, WQ = 2, BK = 4, BQ = 8;
// Rights that survive a move touching a square (a rook or king leaving or being captured).
const CASTLE_MASK = new Array<number>(64).fill(15);
CASTLE_MASK[0] = 15 & ~WQ;
CASTLE_MASK[7] = 15 & ~WK;
CASTLE_MASK[4] = 15 & ~(WK | WQ);
CASTLE_MASK[56] = 15 & ~BQ;
CASTLE_MASK[63] = 15 & ~BK;
CASTLE_MASK[60] = 15 & ~(BK | BQ);

// Precomputed attack tables.
function jumps(deltas: number[][]): number[][] {
  const out: number[][] = [];
  for (let sq = 0; sq < 64; sq++) {
    const f = sq & 7, r = sq >> 3, list: number[] = [];
    for (const [df, dr] of deltas) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) list.push(nr * 8 + nf);
    }
    out.push(list);
  }
  return out;
}
function rays(deltas: number[][]): number[][][] {
  const out: number[][][] = [];
  for (let sq = 0; sq < 64; sq++) {
    const f = sq & 7, r = sq >> 3, dirs: number[][] = [];
    for (const [df, dr] of deltas) {
      const ray: number[] = [];
      let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        ray.push(nr * 8 + nf);
        nf += df;
        nr += dr;
      }
      dirs.push(ray);
    }
    out.push(dirs);
  }
  return out;
}
const KNIGHT = jumps([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
const KING = jumps([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]);
const ROOK_RAYS = rays([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const BISHOP_RAYS = rays([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
// PAWN_FROM[color][sq]: squares a pawn of `color` would have to stand on to attack sq.
const PAWN_FROM: Record<Color, number[][]> = { w: jumps([[-1, -1], [1, -1]]), b: jumps([[-1, 1], [1, 1]]) };
const PAWN_CAPS: Record<Color, number[][]> = { w: jumps([[-1, 1], [1, 1]]), b: jumps([[-1, -1], [1, -1]]) };

const PROMOS: PieceType[] = ["q", "r", "b", "n"];

export class Position {
  board: (Piece | null)[] = new Array(64).fill(null);
  turn: Color = "w";
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings: Record<Color, number> = { w: -1, b: -1 };

  static fromFen(fen: string): Position {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4 || parts.length > 6) throw new Error("FEN needs 4 to 6 fields");
    const [placement, turn, castling, ep, half = "0", full = "1"] = parts;
    const pos = new Position();
    const rows = placement.split("/");
    if (rows.length !== 8) throw new Error("FEN board needs 8 ranks");
    rows.forEach((row, i) => {
      const rank = 7 - i;
      let file = 0;
      for (const ch of row) {
        if (/[1-8]/.test(ch)) {
          file += Number(ch);
        } else {
          const type = ch.toLowerCase();
          if (!"pnbrqk".includes(type)) throw new Error(`Bad piece '${ch}' in FEN`);
          if (file > 7) throw new Error("FEN rank too long");
          const color: Color = ch === type ? "b" : "w";
          pos.board[rank * 8 + file] = pieceOf(color, type as PieceType);
          if (type === "k") {
            if (pos.kings[color] !== -1) throw new Error("More than one king of a colour");
            pos.kings[color] = rank * 8 + file;
          }
          if (type === "p" && (rank === 0 || rank === 7)) throw new Error("Pawn on back rank");
          file++;
        }
      }
      if (file !== 8) throw new Error("FEN rank must have 8 squares");
    });
    if (pos.kings.w === -1 || pos.kings.b === -1) throw new Error("Each side needs a king");
    if (turn !== "w" && turn !== "b") throw new Error("Side to move must be w or b");
    pos.turn = turn;
    if (!/^(-|K?Q?k?q?)$/.test(castling) || castling === "") throw new Error("Bad castling field");
    const has = (sq: number, c: Color, t: PieceType) => pos.board[sq] === pieceOf(c, t);
    if (castling.includes("K") && has(4, "w", "k") && has(7, "w", "r")) pos.castling |= WK;
    if (castling.includes("Q") && has(4, "w", "k") && has(0, "w", "r")) pos.castling |= WQ;
    if (castling.includes("k") && has(60, "b", "k") && has(63, "b", "r")) pos.castling |= BK;
    if (castling.includes("q") && has(60, "b", "k") && has(56, "b", "r")) pos.castling |= BQ;
    if (ep !== "-") {
      const sq = parseSquare(ep);
      if (sq < 0 || (rankOf(sq) !== (turn === "w" ? 5 : 2))) throw new Error("Bad en passant square");
      pos.ep = sq;
    }
    if (!/^\d+$/.test(half) || !/^\d+$/.test(full)) throw new Error("Bad move counters");
    pos.halfmove = Number(half);
    pos.fullmove = Math.max(1, Number(full));
    if (pos.isAttacked(pos.kings[other(pos.turn)], pos.turn)) throw new Error("Side not to move is in check");
    return pos;
  }

  fen(): string {
    const rows: string[] = [];
    for (let r = 7; r >= 0; r--) {
      let row = "", empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 8 + f];
        if (!p) {
          empty++;
          continue;
        }
        if (empty) row += empty;
        empty = 0;
        row += p.color === "w" ? p.type.toUpperCase() : p.type;
      }
      rows.push(empty ? row + empty : row);
    }
    let c = "";
    if (this.castling & WK) c += "K";
    if (this.castling & WQ) c += "Q";
    if (this.castling & BK) c += "k";
    if (this.castling & BQ) c += "q";
    const ep = this.ep >= 0 ? squareName(this.ep) : "-";
    return `${rows.join("/")} ${this.turn} ${c || "-"} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  /** Is `sq` attacked by any piece of colour `by`? */
  isAttacked(sq: number, by: Color): boolean {
    const b = this.board;
    for (const s of PAWN_FROM[by][sq]) if (b[s] === PIECES[by].p) return true;
    for (const s of KNIGHT[sq]) if (b[s] === PIECES[by].n) return true;
    for (const s of KING[sq]) if (b[s] === PIECES[by].k) return true;
    const q = PIECES[by].q;
    for (const ray of ROOK_RAYS[sq]) {
      for (const s of ray) {
        const p = b[s];
        if (p) {
          if (p === q || p === PIECES[by].r) return true;
          break;
        }
      }
    }
    for (const ray of BISHOP_RAYS[sq]) {
      for (const s of ray) {
        const p = b[s];
        if (p) {
          if (p === q || p === PIECES[by].b) return true;
          break;
        }
      }
    }
    return false;
  }

  inCheck(color: Color = this.turn): boolean {
    return this.isAttacked(this.kings[color], other(color));
  }

  pseudoMoves(): Move[] {
    const moves: Move[] = [];
    const b = this.board, us = this.turn, them = other(us);
    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (!p || p.color !== us) continue;
      const add = (to: number, flag: MoveFlag = "normal") => {
        const cap = b[to];
        moves.push({ from, to, color: us, piece: p.type, captured: cap ? cap.type : undefined, flag });
      };
      switch (p.type) {
        case "p": {
          const dir = us === "w" ? 8 : -8;
          const startRank = us === "w" ? 1 : 6;
          const promoRank = us === "w" ? 7 : 0;
          const pushPawn = (to: number, cap: PieceType | undefined, flag: MoveFlag) => {
            if (rankOf(to) === promoRank) {
              for (const promotion of PROMOS) moves.push({ from, to, color: us, piece: "p", captured: cap, promotion, flag });
            } else {
              moves.push({ from, to, color: us, piece: "p", captured: cap, flag });
            }
          };
          const one = from + dir;
          if (!b[one]) {
            pushPawn(one, undefined, "normal");
            const two = one + dir;
            if (rankOf(from) === startRank && !b[two]) pushPawn(two, undefined, "double");
          }
          for (const to of PAWN_CAPS[us][from]) {
            const t = b[to];
            if (t && t.color === them) pushPawn(to, t.type, "normal");
            else if (to === this.ep) pushPawn(to, "p", "ep");
          }
          break;
        }
        case "n":
          for (const to of KNIGHT[from]) if (b[to]?.color !== us) add(to);
          break;
        case "k":
          for (const to of KING[from]) if (b[to]?.color !== us) add(to);
          this.castleMoves(from, add);
          break;
        default: {
          const dirs = p.type === "r" ? ROOK_RAYS[from] : p.type === "b" ? BISHOP_RAYS[from] : [...ROOK_RAYS[from], ...BISHOP_RAYS[from]];
          for (const ray of dirs) {
            for (const to of ray) {
              const t = b[to];
              if (t) {
                if (t.color !== us) add(to);
                break;
              }
              add(to);
            }
          }
        }
      }
    }
    return moves;
  }

  private castleMoves(from: number, add: (to: number, flag: MoveFlag) => void) {
    const us = this.turn, them = other(us), b = this.board;
    const home = us === "w" ? 4 : 60;
    if (from !== home) return;
    const kSide = us === "w" ? WK : BK, qSide = us === "w" ? WQ : BQ;
    if (!(this.castling & (kSide | qSide)) || this.isAttacked(home, them)) return;
    if (this.castling & kSide && !b[home + 1] && !b[home + 2] && b[home + 3] === PIECES[us].r &&
      !this.isAttacked(home + 1, them) && !this.isAttacked(home + 2, them)) add(home + 2, "castleK");
    if (this.castling & qSide && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === PIECES[us].r &&
      !this.isAttacked(home - 1, them) && !this.isAttacked(home - 2, them)) add(home - 2, "castleQ");
  }

  make(m: Move): Undo {
    const b = this.board;
    const undo: Undo = { castling: this.castling, ep: this.ep, halfmove: this.halfmove, fullmove: this.fullmove, captured: b[m.to] };
    const moving = b[m.from]!;
    if (m.flag === "ep") {
      const capSq = m.to + (m.color === "w" ? -8 : 8);
      undo.captured = b[capSq];
      b[capSq] = null;
    }
    b[m.to] = m.promotion ? PIECES[m.color][m.promotion] : moving;
    b[m.from] = null;
    if (m.piece === "k") this.kings[m.color] = m.to;
    if (m.flag === "castleK") {
      b[m.to - 1] = b[m.to + 1];
      b[m.to + 1] = null;
    } else if (m.flag === "castleQ") {
      b[m.to + 1] = b[m.to - 2];
      b[m.to - 2] = null;
    }
    this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
    this.ep = m.flag === "double" ? (m.from + m.to) >> 1 : -1;
    this.halfmove = m.piece === "p" || undo.captured ? 0 : this.halfmove + 1;
    if (m.color === "b") this.fullmove++;
    this.turn = other(this.turn);
    return undo;
  }

  unmake(m: Move, u: Undo) {
    const b = this.board;
    this.turn = m.color;
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.fullmove = u.fullmove;
    b[m.from] = PIECES[m.color][m.piece];
    if (m.piece === "k") this.kings[m.color] = m.from;
    if (m.flag === "ep") {
      b[m.to] = null;
      b[m.to + (m.color === "w" ? -8 : 8)] = u.captured;
    } else {
      b[m.to] = u.captured;
    }
    if (m.flag === "castleK") {
      b[m.to + 1] = b[m.to - 1];
      b[m.to - 1] = null;
    } else if (m.flag === "castleQ") {
      b[m.to - 2] = b[m.to + 1];
      b[m.to + 1] = null;
    }
  }

  legalMoves(): Move[] {
    const us = this.turn, them = other(us);
    return this.pseudoMoves().filter((m) => {
      const u = this.make(m);
      const ok = !this.isAttacked(this.kings[us], them);
      this.unmake(m, u);
      return ok;
    });
  }

  /** Key for repetition: placement, side, castling and an en passant square only if a capture there is legal. */
  repetitionKey(): string {
    const [placement, turn, castling] = this.fen().split(" ");
    let ep = "-";
    if (this.ep >= 0 && this.legalMoves().some((m) => m.flag === "ep")) ep = squareName(this.ep);
    return `${placement} ${turn} ${castling} ${ep}`;
  }
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = pos.legalMoves();
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    const u = pos.make(m);
    n += perft(pos, depth - 1);
    pos.unmake(m, u);
  }
  return n;
}

export const moveToUci = (m: Move): string => squareName(m.from) + squareName(m.to) + (m.promotion ?? "");

/** SAN for a legal move in `pos` (pos is restored afterwards). */
export function toSan(pos: Position, m: Move, legal: Move[] = pos.legalMoves()): string {
  let san: string;
  if (m.flag === "castleK") san = "O-O";
  else if (m.flag === "castleQ") san = "O-O-O";
  else {
    const capture = m.captured !== undefined;
    if (m.piece === "p") {
      san = (capture ? FILES[fileOf(m.from)] + "x" : "") + squareName(m.to);
      if (m.promotion) san += "=" + m.promotion.toUpperCase();
    } else {
      const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      let dis = "";
      if (rivals.length) {
        const sameFile = rivals.some((o) => fileOf(o.from) === fileOf(m.from));
        const sameRank = rivals.some((o) => rankOf(o.from) === rankOf(m.from));
        if (!sameFile) dis = FILES[fileOf(m.from)];
        else if (!sameRank) dis = String(rankOf(m.from) + 1);
        else dis = squareName(m.from);
      }
      san = m.piece.toUpperCase() + dis + (capture ? "x" : "") + squareName(m.to);
    }
  }
  const u = pos.make(m);
  if (pos.inCheck()) san += pos.legalMoves().length === 0 ? "#" : "+";
  pos.unmake(m, u);
  return san;
}

export type DrawReason = "stalemate" | "threefold" | "fifty-move";
export interface GameStatus {
  over: boolean;
  check: boolean;
  reason?: "checkmate" | DrawReason;
  winner?: Color;
}
interface HistoryEntry {
  move: Move;
  undo: Undo;
  san: string;
}

/** A game: a position plus history, with repetition and move-rule tracking. */
export class Game {
  pos: Position;
  history: HistoryEntry[] = [];
  readonly startFen: string;
  private keys: string[];
  private legalCache: Move[] | null = null;

  constructor(fen: string = START_FEN) {
    this.pos = Position.fromFen(fen);
    this.startFen = this.pos.fen();
    this.keys = [this.pos.repetitionKey()];
  }

  get turn(): Color {
    return this.pos.turn;
  }

  moves(): Move[] {
    return (this.legalCache ??= this.pos.legalMoves());
  }

  movesFrom(sq: number): Move[] {
    return this.moves().filter((m) => m.from === sq);
  }

  findMove(from: number, to: number, promotion?: PieceType): Move | undefined {
    return this.moves().find((m) => m.from === from && m.to === to && (m.promotion ?? undefined) === (promotion ?? undefined));
  }

  findUci(uci: string): Move | undefined {
    const from = parseSquare(uci.slice(0, 2)), to = parseSquare(uci.slice(2, 4));
    const promo = uci[4] as PieceType | undefined;
    return this.findMove(from, to, promo);
  }

  /** Plays a legal move (throws if it isn't one). Returns its SAN. */
  play(m: Move): string {
    const legal = this.moves();
    const real = legal.find((o) => o.from === m.from && o.to === m.to && o.promotion === m.promotion);
    if (!real) throw new Error(`Illegal move ${moveToUci(m)}`);
    if (this.status().over) throw new Error("Game is over");
    const san = toSan(this.pos, real, legal);
    const undo = this.pos.make(real);
    this.history.push({ move: real, undo, san });
    this.legalCache = null;
    this.keys.push(this.pos.repetitionKey());
    return san;
  }

  undo(): Move | undefined {
    const last = this.history.pop();
    if (!last) return undefined;
    this.pos.unmake(last.move, last.undo);
    this.keys.pop();
    this.legalCache = null;
    return last.move;
  }

  lastMove(): Move | undefined {
    return this.history[this.history.length - 1]?.move;
  }

  repetitions(): number {
    const now = this.keys[this.keys.length - 1];
    return this.keys.filter((k) => k === now).length;
  }

  status(): GameStatus {
    const check = this.pos.inCheck();
    if (this.moves().length === 0) {
      return check ? { over: true, check, reason: "checkmate", winner: other(this.turn) } : { over: true, check, reason: "stalemate" };
    }
    if (this.repetitions() >= 3) return { over: true, check, reason: "threefold" };
    if (this.pos.halfmove >= 100) return { over: true, check, reason: "fifty-move" };
    return { over: false, check };
  }
}

export function describeResult(s: GameStatus): { title: string; detail: string } {
  const side = (c?: Color) => (c === "w" ? "White" : "Black");
  switch (s.reason) {
    case "checkmate":
      return { title: "Checkmate", detail: `${side(s.winner)} wins` };
    case "stalemate":
      return { title: "Stalemate", detail: "Draw" };
    case "threefold":
      return { title: "Draw", detail: "Threefold repetition" };
    case "fifty-move":
      return { title: "Draw", detail: "Fifty-move rule" };
    default:
      return { title: "", detail: "" };
  }
}
