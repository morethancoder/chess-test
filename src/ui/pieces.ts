// Original piece drawings, built from simple geometric shapes in a 45x45 box.
// No fonts, image files or borrowed artwork.
import type { Colour, PieceType } from '../engine/index.ts';

const BASE = '<rect x="10" y="33" width="25" height="5.5" rx="2.2"/>';

const SHAPES: Record<PieceType, string> = {
  p: `<circle cx="22.5" cy="14.5" r="5.6"/>
      <path d="M16.5 33 L19.2 21.5 Q22.5 19.6 25.8 21.5 L28.5 33 Z"/>${BASE}`,
  r: `<path d="M13.5 9 h4 v3.2 h3 V9 h4 v3.2 h3 V9 h4 v7.5 l-2.5 2.5 V33 h-13 V19 l-2.5 -2.5 Z"/>
      <path class="d" d="M16 19 h13" fill="none"/>${BASE}`,
  n: `<path d="M14.5 33 C14 26 16.5 22.5 19 20 C16.5 19.8 13.2 21.6 11.5 20.4 C10 19.2 11 16.8 13 15.3 L18.6 10.6 L19 6.8 L22.4 9.4 C29.6 9.8 33.6 16.2 33.4 24 L33 33 Z"/>
      <circle class="eye" cx="19.6" cy="14.6" r="1.5"/>
      <path class="d" d="M24 13.6 C28.4 15.6 30.2 20.2 29.8 28" fill="none"/>${BASE}`,
  b: `<circle cx="22.5" cy="7.6" r="2.6"/>
      <path d="M22.5 10.6 C29.6 14.6 30.6 21.4 27 26.4 L28 33 H17 L18 26.4 C14.4 21.4 15.4 14.6 22.5 10.6 Z"/>
      <path class="d" d="M20.4 20.8 L25.6 15.4 M18.6 26.4 H26.4" fill="none"/>${BASE}`,
  q: `<path d="M12.5 33 L10.2 16.4 L16.8 24 L18.8 12.6 L22.5 22.4 L26.2 12.6 L28.2 24 L34.8 16.4 L32.5 33 Z"/>
      <circle cx="10.2" cy="14.6" r="2.3"/><circle cx="18.8" cy="10.6" r="2.3"/>
      <circle cx="26.2" cy="10.6" r="2.3"/><circle cx="34.8" cy="14.6" r="2.3"/>
      <path class="d" d="M14 28.4 H31" fill="none"/>${BASE}`,
  k: `<path d="M21.2 5 h2.6 v3.2 h3.2 v2.6 h-3.2 v4.4 h-2.6 v-4.4 H18 V8.2 h3.2 Z"/>
      <path d="M14 33 C11 26.5 11.6 18.6 17.6 17.4 C20 17 21.6 18.4 22.5 20 C23.4 18.4 25 17 27.4 17.4 C33.4 18.6 34 26.5 31 33 Z"/>
      <path class="d" d="M22.5 20.4 V28 M14.6 28.4 H30.4" fill="none"/>${BASE}`,
};

export function pieceSvg(colour: Colour, type: PieceType): string {
  return `<svg class="piece-svg ${colour === 'w' ? 'pw' : 'pb'}" viewBox="0 0 45 45" aria-hidden="true">${SHAPES[type]}</svg>`;
}

export const PIECE_NAMES: Record<PieceType, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};
