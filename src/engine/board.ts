import type { Color, Piece, PieceType, Square } from "./types.ts";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Internal position. Square index = row*8 + file, row 0 = rank 8. Pieces: "PNBRQK" white, "pnbrqk" black, "" empty. */
export interface Position {
  sq: string[];
  turn: Color;
  castling: number; // bits: K=1 Q=2 k=4 q=8
  ep: number; // en passant target index or -1
  half: number;
  full: number;
}

export const FILES = "abcdefgh";

export function sqName(i: number): Square {
  return FILES[i & 7] + String(8 - (i >> 3));
}

export function sqIndex(s: Square): number {
  if (typeof s !== "string" || s.length !== 2) return -1;
  const f = FILES.indexOf(s[0]);
  const r = s.charCodeAt(1) - 48;
  if (f < 0 || r < 1 || r > 8) return -1;
  return (8 - r) * 8 + f;
}

export function colorOf(p: string): Color {
  return p === p.toUpperCase() ? "w" : "b";
}

export function toPiece(p: string): Piece | null {
  if (!p) return null;
  return { color: colorOf(p), type: p.toLowerCase() as PieceType };
}

export function parseFen(fen: string): Position {
  if (typeof fen !== "string") throw new Error("Invalid FEN");
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4 || parts.length > 6) throw new Error("Invalid FEN: field count");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("Invalid FEN: ranks");
  const sq: string[] = [];
  for (const row of rows) {
    let n = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let k = 0; k < Number(ch); k++) sq.push("");
        n += Number(ch);
      } else if (/[pnbrqkPNBRQK]/.test(ch)) {
        sq.push(ch);
        n++;
      } else throw new Error("Invalid FEN: piece");
    }
    if (n !== 8) throw new Error("Invalid FEN: rank width");
  }
  if (parts[1] !== "w" && parts[1] !== "b") throw new Error("Invalid FEN: turn");
  const turn = parts[1] as Color;
  let castling = 0;
  if (parts[2] !== "-") {
    if (!/^[KQkq]+$/.test(parts[2])) throw new Error("Invalid FEN: castling");
    if (parts[2].includes("K")) castling |= 1;
    if (parts[2].includes("Q")) castling |= 2;
    if (parts[2].includes("k")) castling |= 4;
    if (parts[2].includes("q")) castling |= 8;
  }
  // drop rights that cannot exist
  if (sq[60] !== "K") castling &= ~3;
  if (sq[4] !== "k") castling &= ~12;
  if (sq[63] !== "R") castling &= ~1;
  if (sq[56] !== "R") castling &= ~2;
  if (sq[7] !== "r") castling &= ~4;
  if (sq[0] !== "r") castling &= ~8;
  let ep = -1;
  if (parts[3] !== "-") {
    ep = sqIndex(parts[3]);
    if (ep < 0) throw new Error("Invalid FEN: en passant");
    const wantRow = turn === "w" ? 2 : 5;
    if (ep >> 3 !== wantRow) throw new Error("Invalid FEN: en passant rank");
  }
  const half = parts.length > 4 ? Number(parts[4]) : 0;
  const full = parts.length > 5 ? Number(parts[5]) : 1;
  if (!Number.isInteger(half) || half < 0) throw new Error("Invalid FEN: halfmove");
  if (!Number.isInteger(full) || full < 1) throw new Error("Invalid FEN: fullmove");
  let wk = 0;
  let bk = 0;
  for (let i = 0; i < 64; i++) {
    if (sq[i] === "K") wk++;
    if (sq[i] === "k") bk++;
    if ((sq[i] === "P" || sq[i] === "p") && (i < 8 || i >= 56)) throw new Error("Invalid FEN: pawn on back rank");
  }
  if (wk !== 1 || bk !== 1) throw new Error("Invalid FEN: kings");
  return { sq, turn, castling, ep, half, full };
}

export function toFen(pos: Position): string {
  let out = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.sq[r * 8 + f];
      if (!p) empty++;
      else {
        if (empty) out += empty;
        empty = 0;
        out += p;
      }
    }
    if (empty) out += empty;
    if (r < 7) out += "/";
  }
  const c = (pos.castling & 1 ? "K" : "") + (pos.castling & 2 ? "Q" : "") + (pos.castling & 4 ? "k" : "") + (pos.castling & 8 ? "q" : "");
  return `${out} ${pos.turn} ${c || "-"} ${pos.ep >= 0 ? sqName(pos.ep) : "-"} ${pos.half} ${pos.full}`;
}
