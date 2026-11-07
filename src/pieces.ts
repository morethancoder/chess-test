// Original piece set, drawn as SVG paths in code (100x100 viewBox). No fonts or images.
import type { Piece } from "./chess.ts";

const BASE = `<path d="M24 86 Q24 76 34 76 H66 Q76 76 76 86 Z" class="body"/>`;

const SHAPES: Record<string, string> = {
  P: `<circle cx="50" cy="30" r="12" class="body"/>
      <path d="M40 44 H60 Q58 56 66 76 H34 Q42 56 40 44 Z" class="body"/>${BASE}`,
  R: `<path d="M28 20 H38 V28 H45 V20 H55 V28 H62 V20 H72 V40 L64 46 V66 L72 76 H28 L36 66 V46 L28 40 Z" class="body"/>
      <path d="M24 86 Q24 78 32 78 H68 Q76 78 76 86 Z" class="body"/>`,
  N: `<path d="M30 76 C30 56 36 46 46 38 L40 28 L52 22 C64 22 74 34 72 52 L70 76 Z" class="body"/>
      <circle cx="53" cy="33" r="3" class="mark"/>
      <path d="M40 48 Q47 52 50 46" class="line"/>${BASE}`,
  B: `<circle cx="50" cy="20" r="6" class="body"/>
      <path d="M50 27 C68 38 70 56 62 66 H70 V76 H30 V66 H38 C30 56 32 38 50 27 Z" class="body"/>
      <path d="M44 44 L56 56" class="line"/>${BASE}`,
  Q: `<circle cx="22" cy="28" r="5" class="body"/><circle cx="36" cy="20" r="5" class="body"/>
      <circle cx="50" cy="16" r="5" class="body"/><circle cx="64" cy="20" r="5" class="body"/>
      <circle cx="78" cy="28" r="5" class="body"/>
      <path d="M24 34 L36 56 L42 28 L50 54 L58 28 L64 56 L76 34 L72 72 H28 Z" class="body"/>
      <path d="M22 86 Q22 74 34 74 H66 Q78 74 78 86 Z" class="body"/>`,
  K: `<path d="M46 10 H54 V18 H62 V26 H54 V34 H46 V26 H38 V18 H46 Z" class="body"/>
      <path d="M50 34 C72 34 82 50 72 68 L76 76 H24 L28 68 C18 50 28 34 50 34 Z" class="body"/>
      <path d="M32 58 H68" class="line"/>
      <path d="M22 86 Q22 76 32 76 H68 Q78 76 78 86 Z" class="body"/>`,
};

export function pieceSvg(p: Piece): string {
  return `<svg class="piece-svg ${p[0] === "w" ? "white" : "black"}" viewBox="0 0 100 100" aria-hidden="true">${SHAPES[p[1]]}</svg>`;
}

export const PIECE_NAMES: Record<string, string> = {
  P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king",
};
