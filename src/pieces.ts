// Original piece art, drawn as SVG shapes on a 100x100 canvas. Colours come from CSS variables.
import type { Piece } from "./engine.ts";

const BASE = '<rect x="22" y="76" width="56" height="12" rx="5"/>';

const SHAPES: Record<string, string> = {
  P:
    BASE +
    '<path d="M36 76 C38 62 42 54 44 47 H56 C58 54 62 62 64 76 Z"/>' +
    '<rect x="36" y="42" width="28" height="7" rx="3.5"/>' +
    '<circle cx="50" cy="31" r="12"/>',
  R:
    BASE +
    '<path d="M31 76 L35 42 H65 L69 76 Z"/>' +
    '<path d="M28 42 V20 H38 V27 H45 V20 H55 V27 H62 V20 H72 V42 Z"/>',
  N:
    BASE +
    '<path d="M30 76 C30 58 38 48 47 40 L40 35 L42 22 L51 28 C65 22 77 38 72 58 L70 76 Z"/>' +
    '<circle cx="54" cy="37" r="2.6" class="mark"/>' +
    '<path d="M38 52 C42 50 45 47 47 44" class="line"/>',
  B:
    BASE +
    '<path d="M35 76 C38 62 42 58 44 52 H56 C58 58 62 62 65 76 Z"/>' +
    '<ellipse cx="50" cy="36" rx="12" ry="17"/>' +
    '<circle cx="50" cy="14" r="5"/>' +
    '<path d="M50 28 L58 38" class="line"/>',
  Q:
    BASE +
    '<path d="M26 76 L20 34 L34 52 L35 26 L44 50 L50 22 L56 50 L65 26 L66 52 L80 34 L74 76 Z"/>' +
    '<circle cx="20" cy="31" r="4.5"/><circle cx="35" cy="22" r="4.5"/><circle cx="50" cy="18" r="4.5"/>' +
    '<circle cx="65" cy="22" r="4.5"/><circle cx="80" cy="31" r="4.5"/>',
  K:
    BASE +
    '<path d="M29 76 C28 62 34 54 38 48 H62 C66 54 72 62 71 76 Z"/>' +
    '<path d="M34 48 C34 40 42 36 50 38 C58 36 66 40 66 48 Z"/>' +
    '<path d="M46 8 H54 V15 H61 V23 H54 V38 H46 V23 H39 V15 H46 Z"/>',
};

export function pieceSvg(piece: Piece): string {
  return (
    '<svg class="piece" data-piece="' + piece + '" viewBox="0 0 100 100" aria-hidden="true">' +
    '<g class="art ' + (piece[0] === "w" ? "white" : "black") + '">' + SHAPES[piece[1]] + "</g></svg>"
  );
}

export const PROMO_LABEL = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" } as const;
