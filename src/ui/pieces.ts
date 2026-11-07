// Original geometric piece set, drawn in code. viewBox 0 0 100 100.
import type { Color, PieceType } from "../engine/index.ts";

const BASE = `<path d="M24 80 h52 a4 4 0 0 1 4 4 v6 h-60 v-6 a4 4 0 0 1 4-4z"/>`;

const SHAPES: Record<PieceType, string> = {
  p: `<circle cx="50" cy="31" r="12"/>
      <path d="M38 46 h24 l-4 6 c6 8 10 17 12 28 h-40 c2-11 6-20 12-28z"/>
      ${BASE}`,
  r: `<path d="M27 16 h11 v8 h6 v-8 h12 v8 h6 v-8 h11 v20 h-46z"/>
      <path d="M32 36 h36 l-4 6 v28 l6 10 h-40 l6-10 v-28z"/>
      <path class="d" d="M36 44 h28 M36 68 h28" fill="none"/>
      ${BASE}`,
  b: `<circle cx="50" cy="12" r="5"/>
      <path d="M50 17 c12 9 20 22 20 34 c0 9 -8 15 -20 15 c-12 0 -20 -6 -20 -15 c0 -12 8 -25 20 -34z"/>
      <path class="d" d="M57 30 l-11 14" fill="none"/>
      <path d="M37 66 h26 l5 14 h-36z"/>
      ${BASE}`,
  n: `<path d="M30 80 L36 64 L45 50 L34 55 L24 55 L20 47 L35 28 L46 19 L50 9 L57 18 C70 23 77 37 76 54 L74 80 Z"/>
      <circle class="e" cx="42" cy="32" r="3.2"/>
      <path class="d" d="M60 24 C68 32 70 44 68 58" fill="none"/>
      ${BASE}`,
  q: `<path d="M27 72 L19 32 L32 52 L36 26 L44 49 L50 20 L56 49 L64 26 L68 52 L81 32 L73 72 Z"/>
      <circle cx="19" cy="29" r="4.5"/><circle cx="36" cy="23" r="4.5"/>
      <circle cx="50" cy="16" r="5"/><circle cx="64" cy="23" r="4.5"/>
      <circle cx="81" cy="29" r="4.5"/>
      <rect x="26" y="70" width="48" height="10" rx="2"/>
      ${BASE}`,
  k: `<path d="M46 8 h8 v8 h8 v8 h-8 v12 h-8 v-12 h-8 v-8 h8z"/>
      <path d="M28 70 C22 56 24 40 37 38 C44 37 48 42 50 47 C52 42 56 37 63 38 C76 40 78 56 72 70 Z"/>
      <path class="d" d="M50 47 V68" fill="none"/>
      <rect x="26" y="68" width="48" height="12" rx="2"/>
      ${BASE}`,
};

export function pieceSvg(color: Color, type: PieceType): string {
  return `<svg class="piece-svg ${color === "w" ? "pw" : "pb"}" viewBox="0 0 100 100" aria-hidden="true">
    <g stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${SHAPES[type]}</g></svg>`;
}

export const PIECE_NAMES: Record<PieceType, string> = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};
