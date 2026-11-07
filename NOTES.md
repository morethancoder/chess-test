# Notes

Layout: `src/engine.ts` (rules, perft, game outcome), `src/pieces.ts` (SVG pieces), `src/main.ts` (UI), `src/style.css`,
`scripts/perft.ts` (CLI), `scripts/shots.mjs` (screenshots into `.playwright/`).

Reading choices where the brief was unclear:

- **`npm run perft`** prints the bare count from the script, but npm itself prints its two-line `> chess-trainer…` banner
  before it. Use `npm run -s perft -- "<fen>" <depth>` (or the last line of output) for the count alone. I couldn't set
  `loglevel=silent` in an `.npmrc` here.
- **Puzzle answers**: the solution move is accepted; on the final move any move that checkmates is also accepted
  (some puzzles have several mates). Earlier moves must match the solution. A wrong move is not played: it is flagged
  and the piece stays put so the player can retry. Mate-in-2 defender replies auto-play after ~0.5 s.
- **Puzzle orientation**: the board is turned so the side to move is at the bottom. Two-player games keep White at the
  bottom; "Flip board" is available.
- **Insufficient material** (K vs K, K+minor vs K) is also treated as a draw; the brief did not ask for it but a game
  can otherwise never end.
- **Repetition** counts positions with the same pieces, side to move, castling rights and (only if a legal en passant
  capture exists) en passant square.
- **Invalid `?fen=`** falls back to the standard start with a note in the status line. `?puzzle=n` out of range opens
  puzzle 1. Switching modes updates the URL with `replaceState`.
- **Game over** shows an overlay (`data-testid="game-over"`) with New game / View board; the result also stays in the
  status line after the overlay is dismissed.
- Pawn promotion via drag or tap opens the picker; clicking outside the picker cancels the move.
- Drag works through pointer events (mouse and touch); the board uses `touch-action: none`.
