# Notes: readings of unclear points in the brief

- **Perft runner**: `npm run perft` runs `node scripts/perft.ts` via Node's built-in
  TypeScript type stripping (Node ≥ 23.6; developed on Node 25). No extra dependency.
  The script's own stdout is only the count; npm prints its usual `> chess-trainer perft`
  header lines before it (use `npm run --silent perft -- ...` to drop them).
- Screenshots: `node scripts/screenshots.mjs http://localhost:<port>` with a dev
  server running writes 390/1280 × light/dark shots to `.playwright/` (gitignored).
- **Puzzle answers**: on the *final* move of a puzzle, any checkmating move is
  accepted (a mate-in-1 can have more than one mate). Earlier moves in a mate-in-2
  must match the listed solution move, because the defender's reply is scripted.
- **Wrong puzzle moves**: the move is taken back at once, the from/to squares are
  tinted red and a message names the move. The player can try again straight away;
  "Retry" resets the puzzle.
- **Defender reply** in mate-in-2 is played automatically ~0.45 s after the correct
  first move; the board is locked during that pause.
- **Puzzle board orientation**: the side to move is at the bottom.
- **Puzzle checkmate** shows `puzzle-solved`, not the game-over screen (game-over is
  for the two-player game).
- **`?fen=`**: an unreadable FEN falls back to the standard start with a notice.
  "New game" always starts from the standard position (and drops `?fen` from the URL).
- **`?puzzle=n`** out of range opens puzzle 1 with a notice. Switching puzzles updates
  the URL (`?puzzle=n`) so back/forward work.
- **Game-over screen** has "New game" and "View board"; Undo is available after game
  over and reopens play.
- Solved puzzles are remembered in `localStorage` (shown as tinted numbers).
- Draws (threefold, fifty-move) are applied automatically, as the brief says; there is
  no claim button.
