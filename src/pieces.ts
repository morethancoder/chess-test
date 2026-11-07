import type { Piece } from "./engine.ts";

// Original piece artwork, drawn from simple geometric primitives in a 45x45 box.
// Fill and stroke come from CSS (.pc-w / .pc-b) so the set follows the theme.
const SHAPES: Record<string, string> = {
  P: `<circle cx="22.5" cy="13.5" r="5.5"/>
      <path d="M22.5 20c-5 3-8 8-8.500 17h17c-.5-9-3.500-14-8.500-17z"/>
      <rect x="11" y="36" width="23" height="4" rx="2"/>`,
  R: `<path d="M12 15V8h4.500v3h4V8h4v3h4V8H33v7z"/>
      <path d="M14.500 15h16l-1.500 18h-13z"/>
      <rect x="11" y="33" width="23" height="7" rx="2"/>`,
  N: `<path d="M12 40c0-9 3-13 7-17l-6 1-3.500-3.500C11 12 16 7 24 7c9 1 13 9 12 19l-1 14z"/>
      <circle cx="22" cy="15" r="1.600" class="eye"/>
      <path d="M13 21l5-3" class="line"/>`,
  B: `<circle cx="22.500" cy="7.500" r="3"/>
      <path d="M22.500 11c7 5 8 12 3.500 17l2.500 5h-12l2.500-5c-4.500-5-3.500-12 3.500-17z"/>
      <path d="M20 17.500h5M22.500 15v5" class="line"/>
      <rect x="11" y="33" width="23" height="7" rx="2"/>`,
  Q: `<path d="M9 14l5.500 19h16L36 14l-6.500 9-2.500-12-4.500 11-4.500-11-2.500 12z"/>
      <circle cx="9" cy="13" r="2.600"/><circle cx="17" cy="9.500" r="2.600"/>
      <circle cx="22.500" cy="8" r="2.600"/><circle cx="28" cy="9.500" r="2.600"/><circle cx="36" cy="13" r="2.600"/>
      <rect x="11" y="33" width="23" height="7" rx="2"/>`,
  K: `<path d="M22.500 3v8M18.500 6.500h8" class="line thick"/>
      <path d="M22.500 12c9 0 13 8 10.500 15.500L34 33H11l1-5.500C9.500 20 13.500 12 22.500 12z"/>
      <rect x="10" y="33" width="25" height="7" rx="2"/>`,
};

export function pieceSvg(piece: Piece, withData = true): string {
  const attr = withData ? ` data-piece="${piece}"` : "";
  return `<svg class="piece pc-${piece[0]}" viewBox="0 0 45 45"${attr} aria-hidden="true">${SHAPES[piece[1]]}</svg>`;
}

export const PIECE_NAMES: Record<string, string> = {
  P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king",
};
