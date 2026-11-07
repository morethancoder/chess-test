export type Colour = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece {
  colour: Colour;
  type: PieceType;
}
export type Square = string; // 'a1'..'h8'
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PromotionPiece;
  flags: { castle?: 'k' | 'q'; enPassant?: boolean; doublePush?: boolean };
  san: string;
  uci: string;
}

export type GameStatus =
  | { state: 'playing'; check: boolean }
  | { state: 'checkmate'; winner: Colour }
  | { state: 'stalemate' }
  | { state: 'draw'; reason: 'threefold' | 'fifty-move' };

/**
 * Internal mutable position. Board index 0 = a8, 63 = h1.
 * Cell values: 0 empty, +1..+6 white p,n,b,r,q,k, -1..-6 black.
 */
export interface Position {
  board: Int8Array;
  turn: 1 | -1; // 1 = white
  castling: number; // bits: 1 K, 2 Q, 4 k, 8 q
  ep: number; // en-passant target index or -1
  halfmove: number;
  fullmove: number;
  kings: [number, number]; // [white, black] king indices
}

/** Internal move. flags: 1 double push, 2 en passant, 4 O-O, 8 O-O-O */
export interface RawMove {
  from: number;
  to: number;
  piece: number; // 1..6
  captured: number; // 0..6
  promo: number; // 0 or 2..5
  flags: number;
}

export interface Undo {
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
}
