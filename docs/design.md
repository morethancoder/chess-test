# Design spec

## Module layout

```
src/
  engine/
    types.ts      Colour, PieceType, Piece, Square, Move, Position, GameStatus
    board.ts      square <-> index helpers, FEN parse/serialise
    movegen.ts    pseudo-legal + legal move generation, attack detection
    game.ts       Game class: history, make/undo, status (mate, stalemate, draws)
    perft.ts      perft(position, depth)
    index.ts      re-exports the public API below
  ui/
    pieces.ts     original SVG piece drawings (code only)
    board-view.ts board rendering, tap + drag input, highlights, promotion picker
    app.ts        modes (play / puzzle), URL params, side panel, game-over
  main.ts         entry: mounts app
  style.css       theme variables, layout
scripts/perft.ts  CLI: `npm run perft -- "<fen>" <depth>` prints only the count
tests/unit/       vitest: perft + one or more tests per rule (brief 4-9)
tests/e2e/        playwright: solve a puzzle, play to checkmate
```

Engine is pure TypeScript with no DOM access. All engine imports use explicit
`.ts` extensions and erasable-only syntax (no enums, no parameter properties,
no namespaces) so `node scripts/perft.ts` runs under Node's native type stripping
(Node 25, no extra dependency).

## Engine API

```ts
type Colour = 'w' | 'b';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
interface Piece { colour: Colour; type: PieceType }
type Square = string;                 // 'a1'..'h8'

interface Move {
  from: Square; to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: 'q' | 'r' | 'b' | 'n';
  flags: { castle?: 'k' | 'q'; enPassant?: boolean; doublePush?: boolean };
  san: string;                         // e.g. "Nf3", "exd6", "O-O", "e8=Q+", "Qh5#"
  uci: string;                         // e.g. "e2e4", "e7e8q"
}

type GameStatus =
  | { state: 'playing'; check: boolean }
  | { state: 'checkmate'; winner: Colour }
  | { state: 'stalemate' }
  | { state: 'draw'; reason: 'threefold' | 'fifty-move' };

class Game {
  constructor(fen?: string);            // default = standard start; throws on invalid FEN
  fen(): string;
  turn(): Colour;
  board(): (Piece | null)[][];          // board()[rank 0..7 from rank 8 down][file 0..7 a..h]
  get(sq: Square): Piece | null;
  moves(from?: Square): Move[];         // legal moves (optionally from one square)
  move(m: { from: Square; to: Square; promotion?: 'q'|'r'|'b'|'n' } | string): Move | null;
                                        // string = UCI; returns null if illegal; promotion
                                        // moves without a promotion piece are illegal
  undo(): Move | null;
  history(): Move[];
  inCheck(): boolean;
  kingSquare(c: Colour): Square;
  status(): GameStatus;                 // checkmate/stalemate first, then 50-move
                                        // (halfmove clock >= 100), then threefold
  isGameOver(): boolean;
}

function perft(fen: string, depth: number): number;
const START_FEN: string;
```

Repetition key = piece placement + side to move + castling rights + en-passant
square (only when an en-passant capture is actually legal). The start position
counts as the first occurrence.

## Visual direction

- **Board**: flat, quiet squares. Light theme: light `#eae4d6`, dark `#8a9a7b`
  (sage green). Dark theme: light `#a7a89a`, dark `#4f5d4a`. Coordinates in
  the corners of the edge squares, small, in the opposite square colour.
- **Pieces**: original geometric SVGs drawn in code — rounded silhouettes built
  from circles, rects and simple paths. White pieces: off-white fill
  `#fbfaf6` with dark stroke `#2b2b2b`; black pieces: `#2b2b2b` fill with light
  inner detail strokes. Stroke 1.6 in a 45×45 viewBox.
- **Highlights**: selected square tinted amber; last move from/to tinted soft
  yellow; legal targets as a centred dot (empty) or ring (capture); king in
  check gets a red radial glow.
- **Chrome**: system font stack, page background `#f6f4ef` / `#1b1d1f`,
  panel cards with 12 px radius and a subtle border. One accent colour
  (teal `#2f7d74` light, `#5fb3a8` dark) for buttons and the active mode tab.
- **Layout 390 px**: single column. Header (title + mode tabs: Play / Puzzles),
  board full width minus 16 px padding (≈358 px, squares ≈44.75 px),
  then status line, then controls (New game / Undo / Flip, or puzzle
  prev/next/retry) and move list underneath. No horizontal scroll.
- **Layout 1280 px**: two columns centred, max width ~1040 px. Board
  min(80vh, 640 px) square on the left, side panel 320 px on the right with
  status, controls, move list (or puzzle info + puzzle list grid 1-12).
- **Overlays**: promotion picker is a small card of four piece buttons anchored
  over the board; game-over is a centred modal over the board with the result
  and a "New game" button.
- Themes follow `prefers-color-scheme` via CSS custom properties only.
