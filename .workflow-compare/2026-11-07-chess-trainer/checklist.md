# Checklist

The numbers match `brief.md`. Each line is met or not.

1. Two-player game on one device from the standard start.
2. Puzzle mode with all 12 puzzles from `public/puzzles.json`: wrong move flagged and retryable, defender reply automatic in mate-in-2, solved state shown, next puzzle reachable.
3. Only legal moves can be played.
4. Castling both sides, only when legal (unmoved king and rook, empty between, not in, through or into check).
5. En passant, only right after the double step.
6. Promotion to Q, R, B or N through a picker.
7. Check shown on the board.
8. Checkmate and stalemate end the game with the result shown.
9. Threefold repetition and the 50-move rule end the game as a draw automatically.
10. Original SVG pieces drawn in code, no fonts, image files or copied art.
11. Polished at 390 px and 1280 px, no horizontal scroll at 390 px.
12. Light and dark themes following `prefers-color-scheme`.
13. Tap to move with legal targets shown.
14. Drag to move with mouse and touch.
15. Selected piece and last move highlighted.
16. Perft tests: start 1–4 and Kiwipete 1–3 with the given counts.
17. A unit test per rule in items 4–9.
18. Playwright e2e: one puzzle solved, one game to checkmate.
19. `npm test`, `npm run e2e`, `npm run build`, `npm run dev` on `$PORT`.
20. `npm run perft -- "<fen>" <depth>` prints only the count.
21. `data-square` on every square, `data-piece` on every piece.
22. `?fen=` and `?puzzle=` URL parameters work.
23. `data-testid` `promotion` (with `data-piece` buttons), `game-over` and `puzzle-solved`.
24. Tests, e2e and build pass, with no console errors.
