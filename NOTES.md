# Notes

Decisions where the brief was unclear (full Q&A in `research.md`):

- Puzzle checking: non-final player moves must match the solution move; the final move may be any checkmating move. A wrong move is not played: the target square flashes red with "try again".
- Puzzle board is oriented with the side to move at the bottom; the two-player game starts White at the bottom and has a Flip button.
- Draws: threefold counts placement, side, castling rights and a legally capturable en passant square. 50-move = halfmove clock 100. Checkmate wins over a draw on the same move. Insufficient material is not an automatic draw (not asked for).
- Invalid `?fen` / out-of-range `?puzzle` fall back to the standard game / puzzle 1 with a notice.
- "Skip"/"Previous"/"Next puzzle" wrap around the 12 puzzles; the URL is kept in sync with `?puzzle=n`.
- `npm run perft` runs `scripts/perft.ts` with Node's built-in TypeScript type stripping (Node 22.18+).
- `scripts/screenshots.mjs` produces the Playwright screenshots in `.playwright/` (git-ignored).
- Touch drag uses pointer events with `touch-action: none` on the board; it is tested with the mouse only (same code path).
