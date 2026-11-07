# Checklist pass

(Named `CHECKLIST-REPORT.md`: on this case-insensitive filesystem `CHECKLIST.md` is the same file as `checklist.md`.)

Result: all 24 lines met on inspection; no code changes were needed. Checked against the code, the
unit/e2e suites, and the running dev server (Playwright screenshots at 390 px and 1280 px in light and
dark, plus a touch-drag run on an iPhone 13 profile). The server's port came from `$PORT` (5113 here).

| # | Status | Note |
|---|--------|------|
| 1 | met | `startPlay()` from `START_FEN`; pass and play, e2e fool's mate. |
| 2 | met | All 12 puzzles are solved in an e2e test. Wrong move flagged and retryable, defender reply after 450 ms, `puzzle-solved` card with Next. |
| 3 | met | Moves come from `legalMoves` (pseudo-legal filtered by king safety); `Game.play` rejects others. |
| 4 | met | Rights, empty squares, and not in/through/into check all tested. |
| 5 | met | `ep` is set only after a double step; unit and e2e tests. |
| 6 | met | Picker with q/r/b/n buttons. |
| 7 | met | `.check` highlight on the king square; "check!" in the status. |
| 8 | met | `game-over` shows the result text. |
| 9 | met | Threefold and 50-move (halfmove ≥ 100) end the game automatically. Reading: checkmate on the 100th halfmove wins over the draw. Insufficient material is also a draw (extra, documented in NOTES.md). |
| 10 | met | `src/pieces.ts` has inline SVG paths; no fonts or image files. |
| 11 | met | No horizontal overflow at 390 px or 1280 px; layout stacks below 760 px. Screenshots viewed. |
| 12 | met | `prefers-color-scheme` media query changes the colour variables. |
| 13 | met | Selection shows target dots, rings for captures; e2e covers it. |
| 14 | met | Pointer-events drag with a ghost piece. Mouse e2e passes; touch drag checked with CDP touch events. |
| 15 | met | `.selected` and `.last` classes. |
| 16 | met | Start 1–4 and Kiwipete 1–3 in `tests/unit/chess.test.ts`. |
| 17 | met | Tests for castling, en passant, promotion, check, checkmate, stalemate, threefold and 50-move. |
| 18 | met | The e2e suite has a puzzle solve and a fool's mate game. |
| 19 | met | The four scripts exist and `npm run dev` serves on `$PORT` (also set in `playwright.config.ts`). |
| 20 | met | `npm run perft -- "<fen>" 3` prints `8902`. |
| 21 | met | `data-square` on all 64 squares, `data-piece` on pieces. |
| 22 | met | `?fen=` (invalid falls back to start) and `?puzzle=` (1-based). |
| 23 | met | `promotion` on the button container, `game-over`, `puzzle-solved`. |
| 24 | met | `npm test` 27 passed, `npm run e2e` 8 passed, `npm run build` OK. No console errors in the screenshot runs or the touch run. |
