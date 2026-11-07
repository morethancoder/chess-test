# Checklist pass

Saved as `CHECKLIST-RESULTS.md`: this macOS filesystem is case-insensitive, so `CHECKLIST.md` would overwrite the tracked `checklist.md`.

No line failed, so no code was changed. Checks were run against the code, the test suites and the running app (Playwright, Chromium, dev server on a spare port).

| # | Result | Note |
|---|--------|------|
| 1 | met | Pass and play from the standard start; covered by the checkmate e2e. |
| 2 | met | All 12 puzzles solved through the UI in a Playwright sweep. A wrong move is flagged and taken back, the defender reply is automatic in mate-in-2, `puzzle-solved` shows, and Next works. |
| 3 | met | Engine rejects illegal moves (unit tests); UI offers legal targets only. |
| 4 | met | Castling unit tests cover both sides and both colours, and every refusal case. |
| 5 | met | En passant tests include expiry and the exposed-king case. |
| 6 | met | Picker with 4 buttons; e2e promotes to a knight. |
| 7 | met | The king square gets a `check` class and the status line shows "Check". |
| 8 | met | Game-over modal shows the result. Checkmate by e2e, stalemate by unit test. |
| 9 | met | Threefold and 50-move are automatic and unit-tested. |
| 10 | met | SVG built in `src/ui/pieces.ts`; no font-face, images or glyph characters found in the source. |
| 11 | met | Screenshots at 390 and 1280 px look fine. Overflow is 0 at 390 px on `/`, `?puzzle` and `?fen`. |
| 12 | met | Dark and light verified with `colorScheme` emulation via a `prefers-color-scheme` media query. |
| 13 | met | Tap-to-move works with mouse and touch; legal targets are shown. |
| 14 | met | Pointer-event drag (mouse covered by e2e); `touch-action: none` is set on the board. A real touch drag was not run, only a touch tap. |
| 15 | met | `selected` and `last` classes are applied in `board-view.ts`. |
| 16 | met | Start 1–4 and Kiwipete 1–3 have the right counts, plus extra positions. |
| 17 | met | `rules.test.ts` has tests for castling, en passant, promotion, check, mate, stalemate and draws. |
| 18 | met | One puzzle e2e and one checkmate e2e; both pass. |
| 19 | met | Scripts exist and pass. `npm run dev` honours `$PORT` (default 5173). `$PORT` was unset in this session, so I ran servers on other ports. |
| 20 | met | `npm run -s perft -- "<fen>" 3` prints `97862`. Plain `npm run` also prints npm's own banner (see NOTES.md). |
| 21 | met | `data-square` on all 64 squares and `data-piece` on pieces, e.g. `wK`. |
| 22 | met | `?fen=` and `?puzzle=` work, with notices for invalid values. |
| 23 | met | `promotion`, `game-over` and `puzzle-solved` test ids are present. |
| 24 | met | 69 unit tests, 4 e2e tests and the build pass. No console errors or warnings on any page tried. |

Readings of unclear lines: 20 is taken to mean the script's own stdout, since npm adds a banner. For 11, "polished" was judged from screenshots.
