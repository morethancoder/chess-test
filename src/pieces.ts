import type { Piece } from "./engine.ts";

// Original piece shapes, drawn as SVG paths in a 100x100 box.
const BASE = '<path d="M24 80 H76 L74 89 H26 Z"/>';

const SHAPES: Record<string, string> = {
  P:
    '<circle cx="50" cy="30" r="11"/>' +
    '<path d="M35 80 C35 60 42 52 44 43 H56 C58 52 65 60 65 80 Z"/>' + BASE,
  R:
    '<path d="M31 80 L35 42 H65 L69 80 Z"/>' +
    '<path d="M27 42 V21 H38 V28 H45 V21 H55 V28 H62 V21 H73 V42 Z"/>' + BASE,
  N:
    '<path d="M31 80 C31 60 38 49 47 41 C41 40 36 36 32 37 L30 28 C34 21 42 16 52 16 C68 18 74 34 72 50 C71 62 70 72 70 80 Z"/>' +
    '<circle class="eye" cx="55" cy="31" r="3"/>' + BASE,
  B:
    '<path d="M50 20 C69 34 71 52 62 62 C60 66 66 71 68 80 H32 C34 71 40 66 38 62 C29 52 31 34 50 20 Z"/>' +
    '<circle cx="50" cy="15" r="5"/>' +
    '<path class="line" d="M43 38 L57 53"/>' + BASE,
  Q:
    '<path d="M27 80 L22 33 L36 54 L50 24 L64 54 L78 33 L73 80 Z"/>' +
    '<circle cx="22" cy="29" r="5"/><circle cx="50" cy="19" r="5"/><circle cx="78" cy="29" r="5"/>' + BASE,
  K:
    '<path d="M30 80 L36 52 C36 44 42 40 50 40 C58 40 64 44 64 52 L70 80 Z"/>' +
    '<path d="M46 10 H54 V18 H62 V26 H54 V40 H46 V26 H38 V18 H46 Z"/>' + BASE,
};

export function pieceSvg(piece: Piece): string {
  const colour = piece[0] === "w" ? "white" : "black";
  return `<svg class="piece-svg ${colour}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${SHAPES[piece[1]]}</svg>`;
}
