// Original piece set, drawn as SVG in a 100x100 box. Each piece is a few
// filled shapes ("body") plus thin detail lines ("line") drawn on top.
import type { Color, PieceType } from "./chess.ts";

const NS = "http://www.w3.org/2000/svg";

interface Shape {
  tag: "path" | "circle" | "rect";
  attrs: Record<string, string | number>;
  detail?: boolean; // drawn as an inner line, not a filled body
}
const path = (d: string, detail = false): Shape => ({ tag: "path", attrs: { d }, detail });
const circle = (cx: number, cy: number, r: number): Shape => ({ tag: "circle", attrs: { cx, cy, r } });
const rect = (x: number, y: number, width: number, height: number, rx = 3): Shape => ({ tag: "rect", attrs: { x, y, width, height, rx } });

const BASE = rect(22, 80, 56, 10, 4);

const SHAPES: Record<PieceType, Shape[]> = {
  p: [
    BASE,
    path("M36 80 C36 66 42 58 45 50 L55 50 C58 58 64 66 64 80 Z"),
    rect(38, 44, 24, 7, 3.5),
    circle(50, 32, 12),
  ],
  r: [
    BASE,
    path("M31 80 L34 47 L66 47 L69 80 Z"),
    rect(27, 41, 46, 8, 2.5),
    path("M29 41 L29 19 L39 19 L39 27 L45.5 27 L45.5 19 L54.5 19 L54.5 27 L61 27 L61 19 L71 19 L71 41 Z"),
    path("M38 60 L62 60", true),
  ],
  n: [
    BASE,
    path("M33 80 C33 68 39 61 48 54 C42 57 35 61 29 61 C22 61 19 55 22 50 C27 42 33 35 39 29 L41 15 L49 23 C66 24 77 42 74 80 Z"),
    path("M57 30 C65 39 69 55 68 72", true),
    { tag: "circle", attrs: { cx: 39, cy: 38, r: 2.8 }, detail: true },
  ],
  b: [
    BASE,
    path("M37 80 C39 72 43 68 44 63 L56 63 C57 68 61 72 63 80 Z"),
    rect(35, 57, 30, 7, 3.5),
    path("M50 20 C64 31 67 45 60 57 L40 57 C33 45 36 31 50 20 Z"),
    circle(50, 15, 5),
    path("M55 31 L46 42", true),
  ],
  q: [
    BASE,
    path("M29 80 L32 68 L68 68 L71 80 Z"),
    path("M32 68 L21 33 L33 49 L36 25 L44 45 L50 21 L56 45 L64 25 L67 49 L79 33 L68 68 Z"),
    circle(21, 31, 4.5),
    circle(36, 23, 4.5),
    circle(50, 18, 4.5),
    circle(64, 23, 4.5),
    circle(79, 31, 4.5),
    path("M35 60 L65 60", true),
  ],
  k: [
    BASE,
    path("M29 80 L32 70 L68 70 L71 80 Z"),
    path("M32 70 C24 56 22 42 33 38 C42 35 48 42 50 48 C52 42 58 35 67 38 C78 42 76 56 68 70 Z"),
    rect(46.5, 12, 7, 26, 2),
    rect(40, 17.5, 20, 7, 2),
    path("M35 62 L65 62", true),
  ],
};

/** Builds the SVG for a piece. `attrs` go on the root element. */
export function pieceSvg(color: Color, type: PieceType, attrs: Record<string, string> = {}): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", `piece piece-${color}`);
  svg.setAttribute("aria-hidden", "true");
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const s of SHAPES[type]) {
    const el = document.createElementNS(NS, s.tag);
    for (const [k, v] of Object.entries(s.attrs)) el.setAttribute(k, String(v));
    el.setAttribute("class", s.detail ? (s.tag === "circle" ? "eye" : "line") : "body");
    svg.appendChild(el);
  }
  return svg;
}

export const PIECE_NAMES: Record<PieceType, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
