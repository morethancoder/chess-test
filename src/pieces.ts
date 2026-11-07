// Original piece set, drawn as SVG paths on a 100×100 grid.
import type { Color, PieceType } from "./chess.ts";

const BASE = `<path d="M24 90 h52 a4 4 0 0 0 4-4 v-3 a4 4 0 0 0-4-4 H24 a4 4 0 0 0-4 4 v3 a4 4 0 0 0 4 4z"/>`;

// Each piece: body shapes (filled + outlined) and detail lines (drawn in the accent colour).
const SHAPES: Record<PieceType, { body: string; detail: string }> = {
  p: {
    body: `${BASE}
      <path d="M33 79 C33 64 40 56 46 52 H54 C60 56 67 64 67 79z"/>
      <rect x="38" y="46" width="24" height="7" rx="3.5"/>
      <circle cx="50" cy="33" r="13"/>`,
    detail: ``,
  },
  r: {
    body: `${BASE}
      <path d="M30 79 L34 70 V42 H66 V70 L70 79z"/>
      <path d="M28 20 h9 v7 h7 v-7 h12 v7 h7 v-7 h9 v18 a4 4 0 0 1-4 4 H32 a4 4 0 0 1-4-4z"/>`,
    detail: `<path d="M35 52 H65 M35 66 H65" />`,
  },
  n: {
    body: `${BASE}
      <path d="M30 79 C30 64 36 56 44 50 C38 50 31 54 25 52 C20 50 20 44 24 40
               C30 34 36 28 40 22 L41 12 L49 20 C64 21 74 36 72 60 C71 68 70 74 70 79z"/>`,
    detail: `<circle cx="44" cy="31" r="2.6" class="dot"/>
      <path d="M58 26 C64 34 66 46 63 60" />
      <path d="M27 45 l4 -1" />`,
  },
  b: {
    body: `${BASE}
      <path d="M36 79 C36 72 38 68 41 64 H59 C62 68 64 72 64 79z"/>
      <path d="M50 18 C63 28 67 42 61 56 L59 64 H41 L39 56 C33 42 37 28 50 18z"/>
      <circle cx="50" cy="14" r="5"/>`,
    detail: `<path d="M55 30 L45 42" /><path d="M41 58 H59" />`,
  },
  q: {
    body: `${BASE}
      <path d="M30 79 L22 36 L33 54 L36 26 L45 50 L50 20 L55 50 L64 26 L67 54 L78 36 L70 79z"/>
      <circle cx="22" cy="33" r="4.5"/><circle cx="36" cy="23" r="4.5"/>
      <circle cx="50" cy="16" r="4.5"/><circle cx="64" cy="23" r="4.5"/>
      <circle cx="78" cy="33" r="4.5"/>`,
    detail: `<path d="M31 68 C42 64 58 64 69 68" />`,
  },
  k: {
    body: `${BASE}
      <path d="M30 79 C27 64 31 52 38 44 H62 C69 52 73 64 70 79z"/>
      <path d="M36 45 C36 33 64 33 64 45z"/>
      <path d="M46 8 h8 v8 h7 v8 h-7 v10 h-8 v-10 h-7 v-8 h7z"/>`,
    detail: `<path d="M31 68 C42 64 58 64 69 68" /><path d="M38 52 H62" />`,
  },
};

export function pieceSvg(color: Color, type: PieceType): string {
  const s = SHAPES[type];
  return `<svg viewBox="0 0 100 100" class="piece-svg ${color === "w" ? "white" : "black"}" aria-hidden="true" focusable="false">
    <g class="body">${s.body}</g><g class="detail">${s.detail}</g></svg>`;
}

const NAMES: Record<PieceType, string> = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};
export const pieceName = (color: Color, type: PieceType) =>
  `${color === "w" ? "white" : "black"} ${NAMES[type]}`;
