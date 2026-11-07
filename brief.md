# Brief: chess puzzle trainer

Build a one-page chess trainer in this repo. It already has a Vite + TypeScript scaffold with
vitest and Playwright installed. Work only inside this folder and commit your work on the current
branch when you are done. Every item in `checklist.md` must be met. The checklist is the same
list as below.

## Scope

1. A two-player game on one device (pass and play), starting from the standard position.
2. A puzzle mode using the 12 puzzles in `public/puzzles.json` (mate-in-1 and mate-in-2, each
   with a FEN and its solution in UCI notation). The player moves for the side to move. A wrong
   move is flagged and can be retried. In mate-in-2 puzzles the defender's reply plays
   automatically. A solved puzzle is clearly shown, with a way to go to the next one.

## Rules

3. Only legal moves can be played.
4. Castling on both sides, only when legal: king and rook unmoved, squares between empty, king
   not in, through or into check.
5. En passant, only on the move right after the double pawn step.
6. Promotion to queen, rook, bishop or knight through a picker.
7. Check is shown on the board.
8. Checkmate and stalemate end the game with the result shown.
9. Threefold repetition and the 50-move rule end the game as a draw automatically.

## Look

10. An original set of pieces drawn in code as SVG. No piece fonts, image files or copied piece
    art.
11. Board and UI polished at phone width (390 px) and desktop (1280 px), with no horizontal
    scroll at 390 px.
12. Light and dark themes that follow the system `prefers-color-scheme`.
13. Tap to move: tap a piece, its legal targets are shown, tap a target.
14. Drag to move with mouse and touch.
15. The selected piece and the last move are highlighted.

## Tests

16. Perft tests in vitest: start position depths 1–4 = 20 / 400 / 8902 / 197281; Kiwipete
    (`r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1`) depths 1–3 =
    48 / 2039 / 97862.
17. One or more unit tests for each rule in items 4–9.
18. Playwright e2e tests: one that solves a puzzle, and one that plays a game to checkmate.

## Fixed interface (outside checks use these exactly; don't rename them)

19. `npm test` runs the unit tests, `npm run e2e` runs the Playwright tests, `npm run build`
    builds, and `npm run dev` serves on the port in `$PORT`.
20. `npm run perft -- "<fen>" <depth>` prints only the node count.
21. Every board square has `data-square="<square>"` (for example `e4`), and every piece has
    `data-piece="<colour><piece>"` (for example `wK`, `bN`).
22. URL parameters: `?fen=<FEN>` starts a two-player game from that position, and `?puzzle=<n>`
    opens puzzle n (counting from 1).
23. The promotion picker has `data-testid="promotion"` with one button per piece,
    `data-piece="q|r|b|n"`. The game-over screen has `data-testid="game-over"` and says the
    result. A solved puzzle shows `data-testid="puzzle-solved"`.

## Done when

24. `npm test`, `npm run e2e` and `npm run build` pass, and the page has no console errors.
