# Notes

How the brief was read where it left room, and a few things worth knowing.

## Layout of the code

- `src/chess.ts` — rules engine (move generation, check/mate/draws, SAN, mate search). No DOM.
- `src/pieces.ts` — the original SVG piece set, drawn from paths and circles in code.
- `src/main.ts` / `src/style.css` — the UI.
- `scripts/perft.ts` — `npm run perft -- "<fen>" <depth>` (runs with Node's built-in TypeScript
  type stripping, Node ≥ 23.6).
- `scripts/screenshots.ts` — takes the 390/1280 × light/dark screenshots into `.playwright/`
  (needs `npm run dev` running).
- `tests/unit/` — perft and per-rule tests; `tests/e2e/` — Playwright.

## Readings of the brief

- **Perft output (item 20).** The script prints only the node count. npm itself prints a
  `> chess-trainer@0.0.0 perft` banner before running any script; that line comes from npm, not
  the script. `npm run -s perft -- …` (or `npm_config_loglevel=silent`) hides it. A project
  `.npmrc` with `loglevel=silent` would hide it for everyone, but writing `.npmrc` was blocked
  in this environment, so it isn't there.
- **Puzzle answers (item 2).** The listed move is always accepted. Another move is also
  accepted if it still forces mate in the remaining moves (checked by a small mate search), so a
  second mating move in a mate-in-1 isn't called wrong. After an alternative first move the
  defender plays some legal reply (every reply loses).
- **Wrong move (item 2).** The move is not played. Its squares flash red and the status line says
  "<move> isn't it — try again". The player can retry right away.
- **Defender reply (item 2).** Plays automatically after ~0.45 s. If the player touches the board
  before then, the reply is played at once first, so fast input (or a test) never gets dropped.
- **Puzzle orientation.** The board is flipped when black is to move in a puzzle. Two-player games
  start with white at the bottom; there is a "Flip board" button.
- **Draws (item 9).** Threefold repetition compares placement, side to move, castling rights and
  the en passant square (only if an en passant capture is actually legal). The 50-move rule ends
  the game when the half-move clock reaches 100; checkmate on that move still counts as mate.
  Both end the game automatically, no claim needed. Insufficient material is not in the brief
  and isn't implemented.
- **`?fen=` (item 22).** An unreadable FEN shows a notice and starts the standard position
  instead. The FEN's half-move clock and move number are honoured. `?puzzle=n` outside 1–12
  shows puzzle 1 with a notice.
- **Game-over screen (item 23).** A card over the board with the result, "New game" and "View
  board" (which closes the card; the result stays in the status line). Undo works after the end.
- **Promotion without the picker.** The engine API defaults to a queen if no piece is given; in
  the UI the picker always appears. Clicking outside it cancels the move.
- **Solved puzzles** are remembered in `localStorage` and ticked in the puzzle grid.
- **Keyboard.** The board takes focus; arrow keys move a cursor, Enter/Space acts as a tap,
  Escape clears the selection.
