export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export interface Piece {
  color: Color;
  type: PieceType;
}
export type Square = string; // "a1".."h8"

export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: "q" | "r" | "b" | "n";
  flags: { enPassant?: boolean; castle?: "k" | "q"; doublePush?: boolean };
  san?: string; // filled by Game.move
}

export type GameStatus =
  | { state: "playing"; check: boolean }
  | { state: "checkmate"; winner: Color }
  | { state: "stalemate" }
  | { state: "draw"; reason: "threefold" | "fifty-move" };
