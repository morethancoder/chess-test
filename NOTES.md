# Notes

Layout: `src/chess.ts` (rules engine), `src/pieces.ts` (SVG pieces), `src/main.ts` + `src/style.css` (UI),
`scripts/perft.ts` (run by `npm run perft`, uses Node's built-in TypeScript stripping),
`scripts/screenshots.ts` (Playwright screenshots into `.playwright/`).

Reading choices where the brief was open:

- **Puzzle answers**: the first move of a mate-in-2 must match the stored solution. On the *last* player move,
  any move that delivers checkmate is also accepted (a mate-in-1 can have several mates). A wrong move is
  rejected, flagged, and the position stays as it was so the player can retry.
- **Puzzle side**: the board is oriented to the side to move; only that side's pieces can be moved. The defender's
  reply plays automatically after ~450 ms; input is locked meanwhile.
- **Game over in puzzles**: a solved puzzle shows `puzzle-solved` (not `game-over`).
- **Draws**: besides threefold and 50-move (halfmove clock ≥ 100, checkmate takes precedence), insufficient
  material (K vs K, K+minor vs K, same-colour bishops only) is also scored as a draw. Repetition ignores the
  en-passant square unless an en-passant capture is actually legal.
- **Two-player mode** has no undo; "Flip board" and "New game" are provided. Switching tabs restarts that mode.
- Invalid `?fen=` falls back to the standard start position; an out-of-range `?puzzle=` wraps around.
- The dev server falls back to port 5173 if `$PORT` is unset.
