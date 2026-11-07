import { START_FEN, TYPE_LETTERS, codeToPiece, idxToSq, parseFen, sqToIdx, toFen } from './board.ts';
import { inCheck, isAttacked, legalMoves, makeMove, unmakeMove } from './movegen.ts';
import type {
  Colour,
  GameStatus,
  Move,
  Piece,
  PieceType,
  Position,
  PromotionPiece,
  RawMove,
  Square,
  Undo,
} from './types.ts';

interface HistoryEntry {
  raw: RawMove;
  undo: Undo;
  move: Move;
}

export class Game {
  private pos: Position;
  private hist: HistoryEntry[] = [];
  private keys: string[] = [];

  constructor(fen: string = START_FEN) {
    this.pos = parseFen(fen);
    // the side that just moved must not be in check
    const mover = (-this.pos.turn) as 1 | -1;
    const moverIdx = mover === 1 ? 0 : 1;
    const otherKing = this.pos.kings[moverIdx];
    if (isAttacked(this.pos, otherKing, this.pos.turn)) {
      throw new Error('Invalid FEN: side not to move is in check');
    }
    this.keys.push(this.key());
  }

  private key(): string {
    const p = this.pos;
    let ep = '-';
    if (p.ep >= 0 && legalMoves(p).some((m) => m.flags & 2)) ep = idxToSq(p.ep);
    return `${toFen(p).split(' ')[0]} ${p.turn} ${p.castling} ${ep}`;
  }

  fen(): string {
    return toFen(this.pos);
  }

  turn(): Colour {
    return this.pos.turn === 1 ? 'w' : 'b';
  }

  board(): (Piece | null)[][] {
    const rows: (Piece | null)[][] = [];
    for (let r = 0; r < 8; r++) {
      const row: (Piece | null)[] = [];
      for (let f = 0; f < 8; f++) row.push(codeToPiece(this.pos.board[r * 8 + f]));
      rows.push(row);
    }
    return rows;
  }

  get(sq: Square): Piece | null {
    const i = sqToIdx(sq);
    return i < 0 ? null : codeToPiece(this.pos.board[i]);
  }

  private toMove(raw: RawMove, legal: RawMove[]): Move {
    const pos = this.pos;
    const letter = TYPE_LETTERS[raw.piece];
    const from = idxToSq(raw.from);
    const to = idxToSq(raw.to);
    let san: string;
    if (raw.flags & 4) san = 'O-O';
    else if (raw.flags & 8) san = 'O-O-O';
    else {
      san = '';
      if (raw.piece === 1) {
        if (raw.captured) san += from[0];
      } else {
        san += letter.toUpperCase();
        const others = legal.filter(
          (m) => m.piece === raw.piece && m.to === raw.to && m.from !== raw.from,
        );
        if (others.length) {
          const sameFile = others.some((m) => (m.from & 7) === (raw.from & 7));
          const sameRank = others.some((m) => m.from >> 3 === raw.from >> 3);
          if (!sameFile) san += from[0];
          else if (!sameRank) san += from[1];
          else san += from;
        }
      }
      if (raw.captured) san += 'x';
      san += to;
      if (raw.promo) san += '=' + TYPE_LETTERS[raw.promo].toUpperCase();
    }
    const u = makeMove(pos, raw);
    if (inCheck(pos)) san += legalMoves(pos).length === 0 ? '#' : '+';
    unmakeMove(pos, raw, u);

    const move: Move = {
      from,
      to,
      piece: letter as PieceType,
      flags: {},
      san,
      uci: from + to + (raw.promo ? TYPE_LETTERS[raw.promo] : ''),
    };
    if (raw.captured) move.captured = TYPE_LETTERS[raw.captured] as PieceType;
    if (raw.promo) move.promotion = TYPE_LETTERS[raw.promo] as PromotionPiece;
    if (raw.flags & 4) move.flags.castle = 'k';
    if (raw.flags & 8) move.flags.castle = 'q';
    if (raw.flags & 2) move.flags.enPassant = true;
    if (raw.flags & 1) move.flags.doublePush = true;
    return move;
  }

  moves(from?: Square): Move[] {
    const legal = legalMoves(this.pos);
    const fi = from === undefined ? -1 : sqToIdx(from);
    if (from !== undefined && fi < 0) return [];
    return legal.filter((m) => fi < 0 || m.from === fi).map((m) => this.toMove(m, legal));
  }

  move(m: { from: Square; to: Square; promotion?: PromotionPiece } | string): Move | null {
    let from: string;
    let to: string;
    let promotion: string | undefined;
    if (typeof m === 'string') {
      const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(m);
      if (!match) return null;
      from = match[1];
      to = match[2];
      promotion = match[3];
    } else if (m && typeof m === 'object') {
      from = m.from;
      to = m.to;
      promotion = m.promotion;
    } else return null;
    const fi = sqToIdx(from);
    const ti = sqToIdx(to);
    if (fi < 0 || ti < 0) return null;
    const promo = promotion === undefined ? 0 : 'pnbrqk'.indexOf(promotion) + 1;
    if (promotion !== undefined && (promo < 2 || promo > 5)) return null;
    const legal = legalMoves(this.pos);
    const raw = legal.find((r) => r.from === fi && r.to === ti && r.promo === promo);
    if (!raw) return null;
    const move = this.toMove(raw, legal);
    const undo = makeMove(this.pos, raw);
    this.hist.push({ raw, undo, move });
    this.keys.push(this.key());
    return move;
  }

  undo(): Move | null {
    const h = this.hist.pop();
    if (!h) return null;
    this.keys.pop();
    unmakeMove(this.pos, h.raw, h.undo);
    return h.move;
  }

  history(): Move[] {
    return this.hist.map((h) => h.move);
  }

  inCheck(): boolean {
    return inCheck(this.pos);
  }

  kingSquare(c: Colour): Square {
    return idxToSq(this.pos.kings[c === 'w' ? 0 : 1]);
  }

  status(): GameStatus {
    const check = inCheck(this.pos);
    if (legalMoves(this.pos).length === 0) {
      return check ? { state: 'checkmate', winner: this.pos.turn === 1 ? 'b' : 'w' } : { state: 'stalemate' };
    }
    if (this.pos.halfmove >= 100) return { state: 'draw', reason: 'fifty-move' };
    const cur = this.keys[this.keys.length - 1];
    let n = 0;
    for (const k of this.keys) if (k === cur) n++;
    if (n >= 3) return { state: 'draw', reason: 'threefold' };
    return { state: 'playing', check };
  }

  isGameOver(): boolean {
    return this.status().state !== 'playing';
  }
}
