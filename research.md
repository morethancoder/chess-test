# Research

## Acceptance criteria (each testable)

1. Opening the page with no params shows a standard-position two-player game; White moves first, then turns alternate.
2. `?puzzle=n` (1–12) opens puzzle n; the side to move in its FEN is the player's side.
3. In puzzle mode a wrong move is flagged visibly and then undone so the player can retry.
4. In a mate-in-2 puzzle, after the correct first move the defender's reply plays automatically.
5. After the final solution move, an element `data-testid="puzzle-solved"` appears, with a Next puzzle control.
6. All 12 puzzles in `public/puzzles.json` are solvable by playing their solution moves (verified by a unit test).
7. Only legal moves can be played; pseudo-legal moves leaving the king in check are rejected.
8. Castling kingside and queenside is available only when king and rook are unmoved, squares between are empty, and the king is not in, through or into check.
9. En passant is available only on the move directly after the double pawn step.
10. Reaching the last rank with a pawn opens `data-testid="promotion"` with four buttons `data-piece="q|r|b|n"`; choosing one promotes to that piece.
11. A king in check has a visible highlight on its square.
12. Checkmate and stalemate end the game; `data-testid="game-over"` states the result (who won, or stalemate).
13. Threefold repetition and the 50-move rule end the game as a draw automatically, with `game-over` shown.
14. Pieces are inline SVG drawn in code; no fonts, image files or external art.
15. At 390 px and 1280 px the layout looks polished; at 390 px `scrollWidth <= clientWidth`.
16. Light and dark themes follow `prefers-color-scheme` (CSS only, no toggle needed).
17. Tap a piece: it is highlighted and its legal targets are marked; tap a target to move.
18. Drag a piece with mouse or touch (pointer events) onto a target to move.
19. Selected piece and last move (from and to squares) are highlighted.
20. Vitest perft: start depths 1–4 = 20/400/8902/197281; Kiwipete depths 1–3 = 48/2039/97862.
21. At least one unit test per rule in items 4–9 of the brief.
22. Playwright e2e: one test solves a puzzle, one plays a game to checkmate.
23. `npm test`, `npm run e2e`, `npm run build` pass; `npm run dev` serves on `$PORT`.
24. `npm run perft -- "<fen>" <depth>` prints only the node count (nothing else on stdout).
25. Every square has `data-square="<sq>"`; every piece has `data-piece="<colour><piece>"` (e.g. `wK`).
26. `?fen=<FEN>` starts a two-player game from that FEN.
27. No console errors on page load or during play.

## Questions and my answers

- **Does a wrong puzzle move need to be a move other than the listed solution?** Yes. For mate-in-1, any move that gives checkmate is also accepted (puzzles may have alternative mates); for mate-in-2, the first move must match the solution (the defender reply is scripted), and the final move must match or deliver mate.
- **How is a wrong move flagged?** The piece is shown on the target briefly with a red highlight and a "Not the solution, try again" message, then the position is restored.
- **Orientation of the board?** Oriented to the side to move in puzzles (puzzle 5 and 6 are Black); White at the bottom in two-player games, fixed (no auto-flip in pass-and-play).
- **Draw by repetition/50-move: claim or automatic?** Automatic, as stated. Repetition key = piece placement + side + castling rights + en passant square (en passant only when a legal capture exists, to be accurate). 50-move: halfmove clock >= 100 plies. If mate occurs on the 100th ply, mate wins.
- **Insufficient material?** Not required; I'll add the draw for K vs K, K+minor vs K as a small extra only if cheap. Decision: include it (dead position), noted in NOTES.md.
- **Invalid `?fen`?** Fall back to the standard position and show a small notice.
- **Invalid `?puzzle`?** Fall back to puzzle 1.
- **`?fen` with a game already over (mate/stalemate)?** Show game-over immediately.
- **Promotion in puzzles (puzzles 5, 9)?** Same picker; the solution with a promotion suffix must match the chosen piece (mate-in-1 alternative: any mate accepted).
- **Defender reply in a promotion puzzle?** Played as UCI incl. suffix.
- **Perft script:** `npm run perft` runs a TS file; use Node's native TS stripping (`node --experimental-strip-types` / default in recent Node) or vite-node-free approach; must print only the number. Check Node version; otherwise use `tsx`-free alternative (vitest can't). Decide at build time.
- **Game UI controls:** New game, Undo (nice-to-have), Mode switch between Two players and Puzzles, puzzle list/next, Reset puzzle.
- **Game-over: can the board still be used?** No; the board is locked, a "New game" button is offered.
- **Dragging details:** pointer events with a ghost piece following the cursor; drop on a legal target moves, else cancels; a tap without movement is handled as tap-to-move.
- **Testing hooks for e2e:** only the specified attributes; e2e clicks squares by `data-square`.

## Verification (end of build)

Criteria 1–27 were checked against the running app. 1, 3, 4, 5, 6, 11–13, 17–19, 25–27 are covered by the e2e tests (including an error-free console check after every test) or screenshots in `.playwright/`; 6–10, 20–21 by unit tests (43 passing); 14–16 by CSS/screenshot review at 390 and 1280 px in light and dark; 23 and 24 by running `npm test`, `npm run e2e`, `npm run build` and `npm run perft`. Not automated: touch drag (criterion 18, touch half).
