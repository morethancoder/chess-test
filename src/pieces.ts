// Original piece artwork, drawn as inline SVG (45x45 viewBox). No fonts or images.
import type { Piece } from "./engine.ts";

const BASE = `<rect class="b" x="9" y="35.5" width="27" height="4.5" rx="2"/>`;

const SHAPES: Record<string, string> = {
  P: `<circle cx="22.5" cy="12.5" r="5.5"/>
      <path d="M15.5 35.5 C15.5 27 18.5 23 22.5 19.5 C26.5 23 29.5 27 29.5 35.5 Z"/>${BASE}`,
  R: `<path d="M12 35.5 L14.5 17 L11 17 L11 8.5 L16.5 8.5 L16.5 12 L20 12 L20 8.5 L25 8.5 L25 12 L28.5 12 L28.5 8.5 L34 8.5 L34 17 L30.5 17 L33 35.5 Z"/>
      <path class="d" d="M14.5 17 H30.5"/>${BASE}`,
  N: `<path d="M12.5 35.5 C12 26 14.5 21 20 17.5 L16.5 14.5 L19 8 L23 10.5 C32 11 34 21 32.5 35.5 Z"/>
      <circle class="e" cx="22" cy="15" r="1.4"/>
      <path class="d" d="M16.5 14.5 L20 17.5"/>${BASE}`,
  B: `<circle cx="22.5" cy="6.8" r="2.6"/>
      <path d="M22.5 9 C29 14.5 31.5 19 28.5 24.5 C27.3 26.8 27 29 28.5 35.5 L16.5 35.5 C18 29 17.7 26.8 16.5 24.5 C13.5 19 16 14.5 22.5 9 Z"/>
      <path class="d" d="M19.5 20.5 L25.5 14.5"/>${BASE}`,
  Q: `<circle cx="9.5" cy="13.5" r="2.5"/><circle cx="16" cy="8.5" r="2.5"/><circle cx="22.5" cy="6.5" r="2.5"/>
      <circle cx="29" cy="8.5" r="2.5"/><circle cx="35.5" cy="13.5" r="2.5"/>
      <path d="M13 35.5 L9.5 15 L16.5 25 L16 10 L22.5 24 L29 10 L28.5 25 L35.5 15 L32 35.5 Z"/>
      <path class="d" d="M14 31 H31"/>${BASE}`,
  K: `<rect x="21" y="3.5" width="3" height="11" rx="1"/><rect x="17.5" y="7" width="10" height="3" rx="1"/>
      <path d="M14 35.5 C14 28 12.5 24 15 20 C17 17 28 17 30 20 C32.5 24 31 28 31 35.5 Z"/>
      <path class="d" d="M16 29 H29"/>${BASE}`,
};

export function pieceSvg(piece: Piece): string {
  return `<svg class="piece-art ${piece[0]}" viewBox="0 0 45 45" aria-hidden="true" focusable="false">${SHAPES[piece[1]]}</svg>`;
}

export const PIECE_NAMES: Record<string, string> = {
  P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king",
};
