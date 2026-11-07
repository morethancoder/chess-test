# Research: acceptance criteria and open questions

## Acceptance criteria (one testable line each, numbered as in brief.md)

1. Opening the app with no params shows a two-player game from the standard position; White and Black can move alternately on one device.
2. `?puzzle=n` opens puzzle n of the 12 in `public/puzzles.json`; the side to move is the player; a wrong move is flagged and undone so it can be retried; in mate-in-2 the defender reply plays automatically; solving shows `data-testid="puzzle-solved"` and a "Next puzzle" control.
3. Illegal moves (leaving own king in check, wrong piece geometry, moving through pieces) cannot be played.
4. Castling both sides is offered only when king and rook are unmoved, squares between empty, and king not in, through or into check.
5. En passant is available only on the move immediately after the double pawn step.
6. Reaching the last rank with a pawn opens the picker `data-testid="promotion"` with buttons `data-piece="q|r|b|n"`; choosing one promotes.
7. A king in check is visibly highlighted on the board.
8. Checkmate and stalemate end the game; `data-testid="game-over"` states the result.
9. Threefold repetition and the 50-move rule end the game as a draw automatically, with the result shown.
10. All pieces are inline SVG drawn in code; no fonts, images, or copied art.
11. At 390 px and 1280 px the layout looks polished and there is no horizontal scroll at 390 px.
12. Colours follow `prefers-color-scheme` light/dark.
13. Tapping a piece selects it and shows its legal targets; tapping a target moves.
14. Dragging a piece to a target moves it, with mouse and touch (pointer events).
15. The selected piece and the last move's from/to squares are highlighted.
16. Vitest perft: start 1–4 = 20/400/8902/197281; Kiwipete 1–3 = 48/2039/97862.
17. Unit tests exist for each rule in items 4–9.
18. Playwright e2e: one solves a puzzle, one plays a game to checkmate.
19. `npm test`, `npm run e2e`, `npm run build` work; `npm run dev` serves on `$PORT`.
20. `npm run perft -- "<fen>" <depth>` prints only the node count.
21. Every square has `data-square="e4"`-style attribute; every piece `data-piece="wK"`-style.
22. `?fen=<FEN>` starts a two-player game from that FEN; `?puzzle=<n>` opens puzzle n (1-based).
23. Test ids as in 6, 8, 2 above.
24. Unit, e2e and build pass; no console errors on the page.

## Questions and my answers

- Q: What counts as a correct puzzle move? A: The first move (and each player move except the last) must equal the solution move. The final move may be any move that delivers checkmate (so alternative mates, e.g. a different promotion piece, are accepted). Any other move is wrong.
- Q: How is a wrong move shown? A: The piece is moved, then a "Not that one — try again" message shows and the board resets after a short delay (~700 ms) to the position before; moves not applied to history. Simpler: the move is never applied; the target square flashes red and a message shows. I choose this (no auto-undo needed).
- Q: Promotion in puzzle 5 (`e2e1q`)? A: Picker is shown; the player picks any piece; queen mates, other mating promotions are accepted by the "any mate" rule.
- Q: Pass-and-play board orientation? A: Fixed, White at the bottom (in puzzles, the side to move at the bottom).
- Q: Game-over in puzzle mode? A: Puzzle ends only on solve; the game-over screen is for two-player games.
- Q: Repetition definition? A: Same placement, side to move, castling rights and en passant square (en passant only counted if a legal capture exists), three times → draw. 50-move: halfmove clock ≥ 100 → draw. Checkmate takes priority over the 50-move rule on the same move.
- Q: Insufficient material? A: Not required; not implemented as automatic draw (noted in NOTES.md).
- Q: Invalid `?fen` or `?puzzle`? A: Fall back to the standard game / puzzle 1, show a small notice.
- Q: Perft CLI runner for TypeScript? A: Node 22+ can strip types; if not, use `vite-node`/`tsx`-free approach: the script is a `.ts` run by `node` with type stripping (erasableSyntaxOnly is already on). Verify the Node version.
- Q: Where do puzzle `?puzzle=n` and the Next button interact? A: Next updates the URL to `?puzzle=n+1` (history.replaceState); after the last puzzle, Next wraps to 1.
- Q: A way to switch modes in the UI? A: Header with "Two players" / "Puzzles" buttons, plus New game / Restart.
- Q: Does a FEN game with position already over (mate) show game-over? A: Yes, immediately.
- Q: Console errors? A: Avoid favicon 404 by adding an inline data-URI favicon.
