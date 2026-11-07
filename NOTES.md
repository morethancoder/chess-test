# Notes

Decisions where the brief left room:

- **Engine** (`src/engine.ts`): own move generator, no libraries. `npm run perft` runs it with Node's built-in TypeScript support.
- **Puzzle answers**: the move must match the stored solution, or deliver checkmate (so an alternative mate is accepted). A wrong move is not played: the squares flash red, a message shows, and the player tries again.
- **Mate-in-2**: the defender's reply plays automatically after a short (450 ms) pause; input is locked meanwhile.
- **Puzzle board orientation**: the side to move is at the bottom. Two-player games start with White at the bottom; there is a Flip button.
- **Puzzle navigation**: "Next" at the last puzzle wraps to puzzle 1. `?puzzle=n` out of range falls back to puzzle 1. The URL is updated as you move between puzzles.
- **`?fen=`**: invalid FEN starts a normal game with a notice. A FEN that is already checkmate/stalemate shows the game-over result at once.
- **Draws**: threefold repetition counts positions with the same pieces, side to move, castling rights and (only if capturable) en passant. 50-move rule fires at a halfmove clock of 100. Checkmate takes priority over the 50-move rule. I also end the game on insufficient material (bare kings, or king + one minor piece vs king); this goes beyond the brief.
- **Undo** (two-player mode) is an extra; it also takes back repetition history.
- **Promotion**: tapping outside the picker or pressing Escape cancels the move.
- Screenshots: `node scripts/screenshots.mjs` starts its own dev server and writes to `.playwright/` (git-ignored).
