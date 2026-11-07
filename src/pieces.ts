import type { Piece } from "./engine.ts";

// Original piece drawings, built from plain SVG shapes (100 x 100 viewBox).
const BASE = `<path class="fill" d="M22 91 H78 L73 80 H27 Z"/>`;

const SHAPES: Record<string, string> = {
  P: `
    <circle class="fill" cx="50" cy="30" r="12"/>
    <path class="fill" d="M37 47 H63 L61 54 H39 Z"/>
    <path class="fill" d="M40 54 H60 C62 66 68 72 73 80 H27 C32 72 38 66 40 54 Z"/>`,
  R: `
    <path class="fill" d="M29 80 L33 47 H28 V22 H39 V30 H45 V22 H55 V30 H61 V22 H72 V47 H67 L71 80 Z"/>
    <path class="line" d="M33 47 H67 M31 66 H69"/>`,
  N: `
    <path class="fill" d="M27 80 C27 62 36 56 44 46 C38 46 33 49 29 55 L23 50 C27 40 36 28 47 24 L51 12 L58 23 C75 28 77 54 73 80 Z"/>
    <circle class="eye" cx="50" cy="34" r="3"/>
    <path class="line" d="M28 52 L36 50 M60 40 C66 48 66 60 64 70"/>`,
  B: `
    <circle class="fill" cx="50" cy="15" r="6"/>
    <path class="fill" d="M50 22 C68 34 72 48 61 58 C65 63 67 70 71 80 H29 C33 70 35 63 39 58 C28 48 32 34 50 22 Z"/>
    <path class="line" d="M43 36 L57 50 M38 64 H62"/>`,
  Q: `
    <path class="fill" d="M28 80 L17 36 L33 57 L35 27 L44 55 L50 22 L56 55 L65 27 L67 57 L83 36 L72 80 Z"/>
    <circle class="fill" cx="17" cy="31" r="5"/><circle class="fill" cx="35" cy="22" r="5"/>
    <circle class="fill" cx="50" cy="17" r="5"/><circle class="fill" cx="65" cy="22" r="5"/>
    <circle class="fill" cx="83" cy="31" r="5"/>
    <path class="line" d="M30 68 H70"/>`,
  K: `
    <path class="fill" d="M46 5 H54 V12 H61 V19 H54 V26 H46 V19 H39 V12 H46 Z"/>
    <path class="fill" d="M28 80 C26 62 30 50 36 44 C33 35 40 28 50 28 C60 28 67 35 64 44 C70 50 74 62 72 80 Z"/>
    <path class="line" d="M37 44 H63 M31 66 H69"/>`,
};

export function pieceSvg(p: Piece): string {
  return `<svg class="piece-art ${p[0]}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${BASE}${SHAPES[p[1]]}</svg>`;
}

export const PIECE_NAMES: Record<string, string> = {
  P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king",
};
