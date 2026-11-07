# Checklist results

No line failed, so no code was changed. Checked against the code, the unit and e2e tests, and a separate Playwright run against the dev server (all 12 puzzles solved through the UI at 390 px in dark mode, touch drag, overflow and console checks).

| # | Status | Note |
|---|--------|------|
| 1 | met | Pass-and-play from the standard start; white stays at the bottom. |
| 2 | met | All 12 puzzles solved through the UI (incl. promotion in 5 and 11). Wrong move flashes red and can be retried; the defender replies after ~0.45 s; the solved dialog has a Next button. Any mating move is also accepted. |
| 3 | met | Moves come only from `legalMoves`; an illegal move is ignored (unit and e2e tests). |
| 4 | met | Unit tests cover both sides, blockers, in, through and into check, and lost rights. |
| 5 | met | Unit tests: available right after the double step, expires a move later, not after a single step. |
| 6 | met | Picker offers q/r/b/n; engine rejects a promotion with no piece. |
| 7 | met | The king's square gets a red glow and the status shows "check!" (two-player mode only). |
| 8 | met | Checkmate and stalemate end the game. Two-player shows the `game-over` screen with the result; puzzles use the solved dialog. |
| 9 | met | Threefold and 50-move end the game automatically (unit tests). A mate on the 100th half-move counts as mate. |
| 10 | met | `src/pieces.ts` draws inline SVG only; no fonts or images. |
| 11 | met | Screenshots at 390 and 1280 px look fine; `scrollWidth` is no wider than the viewport at 390 px. |
| 12 | met | CSS `prefers-color-scheme` variables; dark mode confirmed (body `rgb(23,24,28)`). |
| 13 | met | Tap a piece to show target dots and capture rings, tap a target to move. |
| 14 | met | Pointer-event drag with a ghost piece. Mouse drag is covered by e2e; touch drag (CDP touch events at 390 px) moved e2-e4. The board has `touch-action: none`. |
| 15 | met | `.selected` and `.last` highlights. |
| 16 | met | Start 1-4 and Kiwipete 1-3 in `tests/unit/engine.test.ts`; all pass. |
| 17 | met | Tests exist for castling, en passant, promotion, check, checkmate, stalemate, threefold and 50-move. |
| 18 | met | The e2e suite has 6 tests, including puzzle solves and a game to checkmate. |
| 19 | met | `npm test` (21 passed), `npm run e2e` (6 passed) and `npm run build` pass; `npm run dev` served on `$PORT` (5123). |
| 20 | met | `npm run perft -- "<start fen>" 3` printed only `8902`. |
| 21 | met | `data-square` on all 64 squares; `data-piece` on pieces. The promotion buttons use `q/r/b/n` as the brief specifies. |
| 22 | met | `?puzzle=n` (the e2e and my run) and `?fen=` (e2e) work. Reading unclear: the app rewrites the URL after loading, so a reload of a `?fen=` game starts a fresh game. |
| 23 | met | `promotion`, `game-over` and `puzzle-solved` test ids are present and exercised. |
| 24 | met | Test, e2e and build pass; no console errors (the favicon is an inline data URL). |
