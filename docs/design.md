# Design spec

## Module layout

```
src/
  engine/
    types.ts       shared types (below)
    board.ts       FEN parse/serialise, square helpers
    movegen.ts     pseudo-legal + legal move generation, attack detection
    game.ts        Game class: history, make/undo, status, repetition, 50-move
    perft.ts       perft(position, depth)
    index.ts       re-exports the public API
  engine/*.test.ts unit tests (vitest), incl. perft.test.ts
  ui/
    pieces.ts      original SVG piece drawings (strings per piece)
    board-view.ts  renders board, highlights, tap + pointer drag
    app.ts         modes (play / puzzle), URL params, panels, dialogs
  styles.css
  main.ts          entry; mounts app
scripts/perft.ts   CLI: `npm run perft -- "<fen>" <depth>` prints only the count
tests/e2e/*.spec.ts Playwright
```

The engine has no DOM dependencies. It must run under plain Node 25 with type
stripping (`node scripts/perft.ts`), so: relative imports **with `.ts` extensions**,
no enums, no parameter properties, no namespaces (tsconfig has
`erasableSyntaxOnly`). `import type` for types (`verbatimModuleSyntax`).

## Engine API

```ts
export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export interface Piece { color: Color; type: PieceType }
export type Square = string;            // "a1".."h8"

export interface Move {
  from: Square; to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: "q" | "r" | "b" | "n";
  flags: { enPassant?: boolean; castle?: "k" | "q"; doublePush?: boolean };
  san?: string;                          // filled by Game.move (nice to have)
}

export type GameStatus =
  | { state: "playing"; check: boolean }
  | { state: "checkmate"; winner: Color }
  | { state: "stalemate" }
  | { state: "draw"; reason: "threefold" | "fifty-move" };

export const START_FEN: string;

export class Game {
  constructor(fen?: string);                 // throws Error on invalid FEN
  fen(): string;
  turn(): Color;
  board(): (Piece | null)[][];               // [rank 8..1][file a..h], row 0 = rank 8
  get(sq: Square): Piece | null;
  legalMoves(from?: Square): Move[];         // all legal moves, or from one square
  move(m: { from: Square; to: Square; promotion?: "q"|"r"|"b"|"n" }): Move | null; // null if illegal
  moveUci(uci: string): Move | null;         // "e2e4", "e7e8q"
  undo(): Move | null;
  inCheck(): boolean;
  kingSquare(c: Color): Square;
  status(): GameStatus;
  isGameOver(): boolean;
  history(): Move[];
  lastMove(): Move | null;
}

export function perft(game: Game, depth: number): number;
export function isValidFen(fen: string): boolean;
```

Rules: legal moves only; castling both sides (king & rook unmoved per castling
rights, squares between empty, king not in/through/into check); en passant only
immediately after the double step; promotion to q/r/b/n (a pawn move to the last
rank without `promotion` is illegal via `move()` — UI asks first; `legalMoves`
returns one Move per promotion piece); check/checkmate/stalemate; threefold
repetition (position key = placement + side + castling + *legal* ep square) and
50-move rule (halfmove clock ≥ 100) end the game automatically as a draw.
Checkmate takes priority over the 50-move draw.

Performance target: perft start depth 4 well under 5 s in vitest.

## Visual direction

- **Board:** square, wood-free flat look. Light theme squares `#eae6dc` / `#8a9a7b`
  (sage). Dark theme squares `#3d4450` / `#262b33`, page `#15181d`.
  Coordinates (files/ranks) drawn small inside edge squares.
- **Highlights:** last move = translucent amber overlay on from/to; selected =
  stronger amber; legal targets = centred dot (capture = ring); king in check =
  radial red glow.
- **Pieces:** original geometric SVG set, viewBox 0 0 100 100: rounded bases,
  simple silhouettes (pawn = circle on a trapezoid, rook = crenellated block,
  knight = angular head built from polygons, bishop = mitre with slit, queen =
  five-point crown with balls, king = crown with cross). White pieces fill
  `#fbfaf6` stroke `#2a2a2a`; black fill `#2b2d33` stroke `#0d0d0f` with light
  detail lines. Stroke width ~3.
- **Typography:** system UI stack. Accent colour: amber `#d99a2b`.
- **Layout 390 px:** single column; header (title + mode tabs "Play" /
  "Puzzles"), board full-width (`min(100vw - 16px, 560px)`), status line
  under the board, controls row (New game / Undo / Flip; or Puzzle nav).
  No horizontal scroll.
- **Layout 1280 px:** two columns centred, board ~ min(80vh, 640px) on the
  left, side panel (320 px) on the right with status, move list, controls,
  puzzle info.
- **Dialogs:** promotion picker as a small overlay over the board with four
  piece buttons (`data-testid="promotion"`, buttons `data-piece="q|r|b|n"`).
  Game-over as a modal card (`data-testid="game-over"`) with result text and
  "New game" button. Puzzle solved: a banner in the panel
  (`data-testid="puzzle-solved"`) with "Next puzzle".
- Themes via CSS custom properties switched by `@media (prefers-color-scheme: dark)`.
