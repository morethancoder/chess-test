# Notes

Decisions where the brief was open (see `research.md` for the full Q&A):

- **Puzzle answers:** the first move must match the listed solution; for the final move any checkmating move is accepted (so alternative mates in mate-in-1 count). A wrong move is not played: the target square flashes red, a message shows, and the player tries again.
- **Defender reply** in mate-in-2 plays after a 450 ms delay; input is locked meanwhile.
- **Board orientation:** puzzles show the side to move at the bottom; two-player games start with White at the bottom (Flip board button available, no auto-flip).
- **Draws:** threefold repetition (placement + side + castling + capturable en passant) and 50-move rule (100 plies) are automatic; mate on the same move wins over the draw. I also added draw by insufficient material (K vs K, K+B vs K, K+N vs K), which the brief did not ask for.
- **Invalid `?fen`** falls back to the standard position with a notice; invalid `?puzzle` is clamped to 1–12.
- **Game over** is a card beside/below the board (it does not cover the final position); the board is locked until New game.
- The URL is kept in sync (`?puzzle=n`, or `?fen=` for a non-standard start) so reload keeps the position start.
- `npm run perft` uses Node's built-in TypeScript support (`node scripts/perft.ts`, Node 22.18+/25).
- `scripts/shots.mjs` takes the screenshots in `.playwright/` (needs the dev server up).
- Drag uses pointer events, so mouse and touch share one path; the board sets `touch-action: none`, so the page can't be scrolled by swiping on the board.
- Not tested automatically: touch drag (only mouse drag in e2e).
