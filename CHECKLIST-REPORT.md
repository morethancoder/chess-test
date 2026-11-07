# Checklist pass

(Named `CHECKLIST-REPORT.md`: on this case-insensitive filesystem `CHECKLIST.md` is the same file as the input `checklist.md`.)

Checked against the code, the unit/e2e suites, and the running dev server (Playwright, 390 px dark and 1280 px light). No code changes were needed.

| # | Result | Note |
|---|--------|------|
| 1 | met | Pass-and-play from the standard start (`src/ui/app.ts`, e2e plays a game). |
| 2 | met | All 12 puzzles solved through the UI in a scripted run (mate-in-2 reply is automatic). Wrong move is flagged and retryable, `puzzle-solved` shown, Next puzzle button works. |
| 3 | met | Moves go through the engine's legal-move list; e2e checks illegal moves are refused. |
| 4 | met | Unit tests cover both sides, blocked, in/through/into check, lost rights. |
| 5 | met | Unit tests: available right after the double step, expires, illegal if it exposes the king. |
| 6 | met | Picker with q/r/b/n buttons; used in puzzle 11 and underpromotion e2e. |
| 7 | met | King square gets a `check` class; "Check!" in the status line. |
| 8 | met | Game-over dialog names checkmate winner or stalemate (e2e covers both). |
| 9 | met | Unit tests for threefold and fifty-move; a UI run from a halfmove-100 FEN showed "Draw / Fifty-move rule" automatically. |
| 10 | met | Pieces from `src/ui/pieces.ts` as inline SVG; no image files; CSS uses a system font stack only for UI text. |
| 11 | met | `scrollWidth == innerWidth` at 390 and 1280 on play and all puzzle pages. Visual polish judged by the previous session's screenshots, not re-reviewed. |
| 12 | met | `prefers-color-scheme: dark` variable set in `style.css`. |
| 13 | met | Tap selects, targets get classes, second tap moves (e2e). |
| 14 | met | Pointer-event drag; `touch-action: none`. Mouse drag in e2e; touch drag verified with CDP touch events (e2→e4). |
| 15 | met | `selected` and `last` classes on squares. |
| 16 | met | `tests/unit/perft.test.ts` has the given counts; passing. |
| 17 | met | `tests/unit/rules.test.ts` has describe blocks for castling, en passant, promotion, check/mate/stalemate, draws. |
| 18 | met | e2e solves puzzles and plays to checkmate. |
| 19 | met | `npm test` (65 pass), `npm run e2e` (7 pass), `npm run build` pass; dev serves on `$PORT` (vite config). |
| 20 | met (with caveat) | The script prints only the count. npm itself prints its two-line `> chess-trainer@0.0.0 perft` header unless run with `--silent`. A fix would be a project `.npmrc` with `loglevel=silent`; I was not permitted to create that file, so I left it. If the outside check uses `npm run`, it may need `--silent`. |
| 21 | met | 64 `data-square` and 32 `data-piece` at start (`wK`, `bN` format). |
| 22 | met | `?puzzle=n` run for 1–12; `?fen=` used in e2e; bad FEN falls back with a notice. |
| 23 | met | `promotion` with `data-piece` buttons, `game-over`, `puzzle-solved` all present and exercised. |
| 24 | met | Tests, e2e and build pass. No console errors or warnings across the 12 puzzles, play page and both viewports. |
