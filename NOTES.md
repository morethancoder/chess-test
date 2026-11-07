# Notes

How the brief was read where it left room, and other things worth knowing.

## Layout of the code

- `src/chess.ts` – rules engine (FEN, legal moves, SAN, perft, game status). No DOM.
- `src/pieces.ts` – the original SVG piece set, drawn from paths and shapes in code.
- `src/main.ts`, `src/style.css` – the page.
- `scripts/perft.ts` – the `npm run perft` CLI (run by Node's built-in TypeScript support).
- `tests/unit` – perft, one or more tests per rule (items 4–9), and a check that every puzzle's
  solution is legal and ends in mate.
- `tests/e2e` – Playwright tests (`npm run e2e`). Each test fails on any console or page error.
- `tests/screenshots` – not part of `npm run e2e`; writes screenshots to `.playwright/`:
  `npx playwright test --config tests/screenshots/playwright.config.ts`.

## Readings of the brief

- **Puzzle answers.** A move counts as correct if it equals the listed UCI move. On the last
  move of a puzzle, any move that gives checkmate is also accepted, since another mate is just as
  right. A wrong move is not played: its squares flash red, a message says to try again, and the
  player can move again at once.
- **Defender reply.** Played straight away (in the same step as the player's move) and animated
  with a short delay, so the board never sits in a state where clicks are dropped.
- **Puzzle board orientation.** The board is turned so the solving side is at the bottom
  (puzzles 5 and 6 are Black to move).
- **Solved state / game over.** Shown as a card over the board (`data-testid="puzzle-solved"` /
  `"game-over"`) with "Next puzzle" / "New game" and a "View board" button. After "View board"
  the same test id moves to the result line in the side panel, so exactly one element carries it.
- **Next puzzle after 12** wraps round to puzzle 1.
- **Draws.** Threefold repetition compares placement, side to move, castling rights and the
  en passant square (only when an en passant capture is actually legal). The 50-move rule ends
  the game when the half-move clock reaches 100, unless that move was checkmate.
  Insufficient material is *not* treated as a draw: the brief doesn't ask for it, and ending a
  game automatically on a rule it didn't list could break `?fen=` checks with bare kings.
- **`?fen=`** starts a two-player game from that position (white at the bottom; "Flip board"
  turns it). An invalid FEN shows a notice and starts the normal game instead (no console error).
  `?puzzle=n` outside 1–12 opens puzzle 1 with a notice. The URL is kept in step with the mode
  (`?puzzle=n` while in puzzles).
- **Tap to move.** Tap a piece to show its targets (dots, rings for captures); tap a target to
  move; tap the piece again, an empty square or press Escape to deselect.
- **Drag.** Pointer events, so mouse, touch and pen all work. A drop on an illegal square
  snaps back and keeps the piece selected.
- **Promotion picker** buttons carry `data-piece="q|r|b|n"`. The piece drawings inside them do
  not carry `data-piece`, so `[data-piece]` selectors on the board count only board pieces.
- **Solved puzzles** are remembered in `localStorage` (a tick in the puzzle grid).

## Known limits

- `npm run perft` itself writes only the node count to stdout, but npm prints its own
  `> chess-trainer@0.0.0 perft` banner before it. `npm run --silent perft -- ...` (or
  `npm_config_loglevel=silent`) prints just the number. A project `.npmrc` with
  `loglevel=silent` would hide the banner for everyone, but writing that file was blocked in
  this environment, so it was left out.
