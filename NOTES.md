# Notes

Interpretation choices where the brief was open:

- **Engine** (`src/engine.ts`): plain rules engine, no dependencies. `scripts/perft.ts` backs `npm run perft` (Node runs the TypeScript directly).
- **Draws**: threefold repetition (positions compare placement, side, castling rights, and en passant only when capturable) and the 50-move rule (100 half-moves) end the game automatically. I also added draw by insufficient material (bare kings, or one minor piece), which the brief did not ask for.
- **Checkmate beats the 50-move rule** when both occur on the same move.
- **Puzzles**: the player's move must match the stored solution, except that any move giving checkmate is also accepted. A wrong move is not played; the target square flashes red, a message appears and the player can retry. The defender's reply plays after about 0.45 s. The board is flipped when Black is to move. Puzzle `n` beyond 12 wraps around. The solved dialog's button goes to the next puzzle (and from the last back to the first).
- **URL**: `?fen=` (two-player; invalid FEN falls back to the start position with a notice) and `?puzzle=n`. The app rewrites the URL to `?puzzle=n` while a puzzle is open; other modes clear the query.
- **Promotion picker**: `data-testid="promotion"` wraps exactly the four piece buttons; the Cancel link sits outside it.
- **Game-over screen** is shown only in two-player mode; puzzles use the solved dialog.
- Two-player board does not flip between turns (pass and play, white at the bottom).
- No undo, clocks or engine opponent (not in the brief).
- `scripts/shots.mjs` takes the review screenshots into `.playwright/` (git-ignored).
