# 2026-11-07-chess-trainer

Run: `2026-11-07-chess-trainer`  
Project: `/Users/alitahseen/Demos/chess-test`  
Winner: **r2-A**

## Result

| Variant | Score | Scores | Tokens | Time | Price |
|---|---|---|---|---|---|
| r1-A | 9.0 | correctness 9, completeness 10, code_quality 8, visual 9 | 3337k | 10.8 min | $2.68 |
| r1-B | 7.2 | correctness 7, completeness 10, code_quality 6, visual 6 | 1333k | 4.9 min | $0.77 |
| r1-C | 8.2 | correctness 9, completeness 10, code_quality 7, visual 7 | 3053k | 7.0 min | $1.18 |
| ↳ build (sonnet) | | | 1936k | 5.5 min | $0.84 |
| ↳ check (sonnet) | | | 1116k | 1.5 min | $0.33 |
| r1-D | 8.8 | correctness 9, completeness 10, code_quality 8, visual 8 | 3231k | 7.4 min | $2.35 |
| ↳ build (haiku/opus/sonnet) | | | 2405k | 6.0 min | $2.05 |
| ↳ check (sonnet) | | | 826k | 1.4 min | $0.31 |
| r1-E | 7.0 | correctness 6, completeness 9, code_quality 7, visual 6 | 1492k | 4.9 min | $0.82 |
| r2-A (winner) | 9.2 | correctness 9, completeness 10, code_quality 9, visual 9 | 3361k | 14.7 min | $2.82 |
| r2-B | 7.5 | correctness 7, completeness 10, code_quality 7, visual 6 | 1250k | 4.4 min | $0.73 |
| r2-C | 6.8 | correctness 7, completeness 9, code_quality 6, visual 5 | 2452k | 5.9 min | $1.08 |
| ↳ build (sonnet) | | | 1686k | 4.5 min | $0.78 |
| ↳ check (sonnet) | | | 766k | 1.4 min | $0.30 |
| r2-D | 9.0 | correctness 9, completeness 10, code_quality 9, visual 8 | 3743k | 9.0 min | $2.62 |
| ↳ build (haiku/opus/sonnet) | | | 2845k | 7.5 min | $2.30 |
| ↳ check (sonnet) | | | 897k | 1.5 min | $0.32 |
| r2-E | 8.0 | correctness 9, completeness 10, code_quality 7, visual 6 | 1650k | 4.7 min | $0.83 |
| blind grading | | | 7919k | | $6.58 |
| **whole run** | | | **32821k** | | **$22.46** |

Prices: list $/MTok as of 2026-11-07 (Opus 5.5, Sonnet 5.5, Haiku 5.5; live pricing page), billed per message from the transcripts (input, output, cache writes and cache reads priced separately); tokens are everything the requests processed, cache reads included. Rows marked (est.) had no transcript and use a blend of 90% input.

## Grader notes

- **r1-A**: pass 1: Reply timer cleared on puzzle open (src/main.ts, diff.patch:1060); accepts any move that still forces mate via defenderLost search (src/chess.ts, diff.patch:668), the most correct puzzle judging. e2e solves every puzzle and drags with a finger. The search adds complexity but is contained. Visual polished: status bar, move list, puzzle grid, solved modal naming the move. | pass 2: No real bugs found. Accepts any move that still forces mate (B/diff.patch:1112), cancels the reply timer (B/diff.patch:1060), uses pointer capture, and has a real touch-drag e2e test. Very polished UI: move list, puzzle grid with solved ticks, modal results with View board. main.ts at 673 lines is large but readable. | pass 3: No bugs found. Puzzle accepts any move that still forces mate (forcesMate/defenderLost), the smartest puzzle logic here; cancelReply on every mode change, pending reply flushed on pointerdown. SAN move list, keyboard, overlays with View board. Only 27 unit tests (one per rule) keeps code_quality below F. Wins over F on correctness of puzzle handling.
- **r1-B**: pass 1: Solid compact engine; all rules tested. Real bug: defender reply is a bare setTimeout never cleared (src/main.ts, diff.patch:563-573); switching puzzle within 550 ms runs step++ and a reply on the new puzzle, corrupting it. Tapping the selected piece reselects instead of deselecting. render() rebuilds innerHTML each time. Visual: clean modals, but desktop left-aligned and sparse, tiny coordinates, select-only picker. | pass 2: Bug: the reply setTimeout (F/diff.patch:567) is never cleared on puzzle change. Checking an alternative mate replays the whole line from the puzzle FEN (F/diff.patch:538) instead of using the current game. The phone header layout differs between modes, Puzzle solved shows three times, the knight and king glyphs look rough, and puzzles are chosen from a dropdown. | pass 3: Minor race: reply setTimeout at main.ts:150-159 not cleared; switching within 550 ms runs step++ on the new puzzle, marking a mate-in-1 solved with no move (sub-second). Puzzles tab always reopens puzzle 1 (main.ts:349). Game.play has no legality check; relies on callers. 35 unit, 5 e2e. Phone header layout shifts between modes. Below X on code_quality for thinner e2e.
- **r1-C**: pass 1: Correct puzzle flow: replyTimer is cleared on startPlay/openPuzzle, alternative final mate accepted, selection limited to the player side. e2e solves every puzzle; insufficient material includes same-colour bishops (unasked). Code weaker: render() rebuilds the whole app innerHTML including tabs on every render (src/main.ts). Visual is plain: result card in side panel, desktop slightly left-aligned, select plus buttons. | pass 2: No real bugs found. The reply timer is cleared on navigation (Z/diff.patch:529). The e2e test solves all 12 puzzles and covers castling and en passant via the UI. A wrong move is flagged by a message only, with no square highlight (Z/diff.patch:590). Clean, consistent UI in both themes with a solid promotion dialog, but the desktop layout is sparse and there is no move list. | pass 3: No bugs found. Game class with insufficient material; replyTimer cleared in startPlay and openPuzzle. Strong targeted tests (castling through check, b1-only attack, 100th half-move mate) and 8 e2e, but only 27 unit. Visual clean but desktop layout hugs the left with half the viewport empty. Below A on code_quality: fewer unit tests.
- **r1-D**: pass 1: Modular engine/ui split, timers tracked and cleared (src/ui/app.ts, diff.patch:1706-1713). Unit test proves all 12 puzzle solutions legal and mating; 69 unit tests incl. castling-rights repetition. Wrong puzzle move is actually played then undone after 700 ms (diff.patch:1817-1825), briefly showing an illegal-for-the-puzzle position. Only 4 e2e tests. Polished both themes: move list, puzzle grid, game-over modal with View board. | pass 2: No real bugs found. Modular engine with colocated tests (69 unit, incl. per-puzzle solution validation). Timers are tracked and cleared (X/diff.patch:1707). Only 4 e2e tests, and touch drag is untested (its own report admits this). Polished branded UI with an amber accent, move list, puzzle grid and game-over modal. A wrong move is shown, then taken back after 700 ms. | pass 3: No bugs found. Modular engine, 69 unit tests, but only 4 e2e (fewest). Wrong move flashed and undone after 700 ms; clearTimers on new game and puzzle open; any mating move accepted. New game restarts from ?fen start, acceptable. Polished amber theme with overlays and move list. Below E on code_quality due to thin e2e.
- **r1-E**: pass 1: Same stale-timer bug as A: reply window.setTimeout (src/main.ts, diff.patch:655-660) is not stored; resetTransient only clears wrongTimer, so switching puzzle mid-reply corrupts the new puzzle. No unit test that check is detected (describe 'check, mate, stalemate' at diff.patch:1351 tests only mate, stalemate, undo). Visual: promotion picker without title or cancel, duplicate status line and two New game buttons on game over. | pass 2: Rules are correct and well tested (43). Bug: the reply setTimeout (D/diff.patch:655) is not tracked or cleared by resetTransient (D/diff.patch:587), so changing puzzle during the 450 ms delay plays the old reply on the new puzzle. UI is decent with a puzzle grid, but the promotion picker has no label and New game is duplicated in the mate state. | pass 3: Real bug: startGame (main.ts:36-49) never resets solved (only startPuzzle does, main.ts:57); canInteract (main.ts:82) requires !solved, so after solving any puzzle the Two players board and New game are locked. Normal users hit this, breaking pass-and-play. Also uncleared reply timer at main.ts:130. Visual: checkmate text shown three times, duplicated New game.
- **r2-A**: pass 1: Defender reply played synchronously with an animation delay (src/main.ts, diff.patch:1000-1015), so no timer race; wrong move undone and flashed, wrongTimer cleared. 53 unit tests plus 15 e2e including CDP touch tap/drag, threefold and castling via UI. Most polished UI: blurred modals, move list, puzzle grid with solved ticks, hint, promotion cancel; good at both widths and themes. | pass 2: No real bugs found. The defender reply is applied synchronously and animated (C/diff.patch:1010), so there is no timer race. Broadest tests: 53 unit (extra perft positions, puzzle validation) and 15 e2e incl. touch tap/drag, castling and threefold via the UI. Most polished UI: overlays, move list, puzzle grid, hint. CSS is heavy (648 lines). | pass 3: No bugs found. Position class with make/unmake and legal-move cache; defender reply is immediate so no timer race. 53 unit and 15 e2e tests, the strongest suite. Polished blurred-backdrop overlays, puzzle grid, Hint. Scored 9 on correctness only because its puzzle checking is less forgiving than D's forced-mate acceptance; very close runner-up.
- **r2-B**: pass 1: Clear engine and thorough rule tests (36). Same stale-timer bug as A: puzzle reply setTimeout (src/main.ts, diff.patch:542-550) is never stored or cleared; startPuzzle does not cancel it, so a quick puzzle switch plays a reply and step++ on the new puzzle. Has Undo and compact solved card. Visual adequate but plain: status text below the board, little hierarchy. | pass 2: All checks pass; solid rule tests (35) incl. castling-through-check and ep pin. Bug: defender reply setTimeout (A/diff.patch:542) is never cancelled, and startPuzzle (A/diff.patch:461) does not clear it, so switching puzzle within 450 ms plays the old reply and bumps step on the new puzzle. Clean but plain UI with a sparse desktop sidebar. | pass 3: Rules correct. Minor race: reply setTimeout at main.ts:138 never cancelled; Restart/Next/mode switch within 450 ms runs state.step += 1 on the new puzzle (sub-second, rare). No research note. Visual plainest of the set: bare panel, redundant checkmate text, small desktop promotion picker. Ranks below X/Z on visual and polish.
- **r2-C**: pass 1: Uncancellable async wait(450) for the defender reply (src/main.ts, diff.patch:624-636) captures the old puzzle p but the global game and solIdx, so switching puzzle mid-reply does solIdx++ and may mark the new puzzle solved. Fewest tests (21 unit, 6 e2e). Visual minimal: small ~415 px board on a sparse 1280 px page, no Flip or Undo, only a New game button. | pass 2: Engine is fine (21 tests, fewest). Bug: the async reply (E/diff.patch:624) cannot be cancelled, giving the same race on puzzle change. The UI is minimal: only New game (no flip or undo), a small centred board with a mostly empty 1280 px layout, and odd king glyphs, so item 11 polish is only partly met. | pass 3: Clean 345-line engine, wrong move flagged without being played. Minor race: async wait(450) reply at main.ts:134-146 never cancelled; switching puzzle within 450 ms runs solIdx++ and can mark the new puzzle solved (sub-second, rare). 21 unit, 6 e2e incl. retry and stalemate. Neat overlays both themes. Beats Z on code_quality: more thorough e2e.
- **r2-D**: pass 1: Modular engine/ui; reply timer cleared in openPuzzle and Play tab (src/ui/app.ts, diff.patch:1329, 1404). Wrong move undone with SAN message. 65 unit tests incl. SAN disambiguation (an extra that powers the move list). An alternative mate on move one of a mate-in-2 is rejected (diff.patch:1356), minor. Visual good with move list and grid, but the solved state is only a line of text. | pass 2: No real bugs found. A cleanly modular engine (board/movegen/game) and UI, with 65 unit tests incl. SAN disambiguation. The reply timer is cleared (G/diff.patch:1329) and wrong moves are undone with a SAN message. Polished green board, move list, puzzle grid and checkmate overlay. Touch drag was only checked manually via CDP, not in e2e. | pass 3: Modular Int8Array engine with make/unmake, 65 unit tests. Wrong move played then undone; reply timer cleared. History via pushState/popstate, game-over modal, promotion Cancel. Minor: empty puzzle list would crash; Next disabled on puzzle 12. Ties G on correctness but beats it on tests (7 e2e vs 4).
- **r2-E**: pass 1: Timers tracked and cleared (src/main.ts, diff.patch:540-550); final move accepts any mate. Tests cover each rule, plus puzzle count. No real bugs found. Visual is the weak point: redundant panels ('Puzzle solved' plus 'Solved!', 'Checkmate' plus 'Game over'), and the queen SVG is a crude crown next to the other pieces. | pass 2: No real bugs found. Timers are tracked and cleared (Y/diff.patch:540), and alternative mates are accepted via a probe game. Tests are adequate (42). The UI is plain: duplicate solved cards (Puzzle solved plus Solved!), a Game over card that holds only Flip board, and no move list. | pass 3: Clean engine: FEN validation, ep in repetition key only when capturable, mate on 100th half-move wins. Reply timer cleared on reset. Minor: Puzzles tab throws at main.ts:74 if puzzles.json fails to load. Good per-rule tests and e2e. Beats Y on code quality for broader e2e (retry, black promotion, drag). Visual plain: blue-grey dark board, mate text repeated.

## Conclusion

Scores are the medians of three blind Opus passes (correctness, completeness, code quality,
visual; total out of 40). All ten builds passed all 14 outside checks, so the hold rule turns
on the grades alone. Variant averages over both rounds: A 36.5, D 35.5, C 30, E 30, B 29.5.

**Hold rule** (a cheaper variant holds if it is within 1 point of the best in both runs and its
code checks pass): **only D holds.** D scored 35 vs A's 36 (round 1) and 36 vs 37 (round 2), at
$2.35 vs $2.68 and $2.62 vs $2.82 (about 9% cheaper). B, C and E fail in at least one round. On
the per-line average scale C is within 1 in round 1 (8.25 vs 9.0), then drops to 6.75 in round 2.
The gap is mostly visual (A 9, D 8, B/C/E 5–7) and code quality (A 8–9, D 8–9, others 6–7).

- **C vs A** (does a Sonnet checklist pass close the gap on correctness, completeness and code?):
  no. Completeness is about equal (C 10/9, A 10/10), but C's correctness (9/7) and code (7/6) trail
  A (9/9, 8/9). C's checklist pass cost $0.30–0.33 and made no measurable difference over plain B
  (C 33/27 vs B 29/30).
- **D vs C on visual:** D wins with both judges. Grader visual: D 8/8 vs C 7/5. User rating (blind, 1–10): D 8/9 vs C 7/7.
- **D's Haiku share:** the Haiku `reader`s cost $0.006 (r1) and $0.005 (r2), or 0.2–0.3% of D's
  build cost. The Opus lead was about 74% and the Sonnet `editor` (engine plus tests) about 25%.
  Both D leads took the brief only from the reader's summary and never read brief.md themselves.
  Both summaries were checked against the sources (items quoted verbatim, perft counts, puzzle
  sides and promotion suffixes) and were accurate. Neither misled the lead, and D missed no
  checklist line. Haiku was cheap and harmless here, but the brief was small, so it saved little.
- **E vs D** (research note first vs the split): D is clearly better (35/36 vs 28/32), and E costs
  about a third as much ($0.82/0.83). E's round-1 build had the run's only lock bug (below).
  Research-first on Sonnet did not lift quality over plain Sonnet (E 30 vs B 29.5 on average).
- **A vs D:** D is about 1 point below A in each round and 7–9% cheaper. The Sonnet editor's
  engine was as correct as Opus's (correctness 9 in both rounds for both). The point lost is
  visual (8 vs 9).
- **E vs C:** a tie on average (30 vs 30), with opposite rounds (C 33→27, E 28→32), at E $0.83 vs
  C $1.13. Round-to-round variance on Sonnet alone (5–6 points) is larger than any method effect
  between B, C and E.
- **Grader vs user:** the user rated all ten blind (1–10, cards in random order under their own random numbers).
  Both judges pick the same winner, r2-A. The user rated r2-A and r2-D 9, and r2-A was ahead on
  card order. Spearman between the user's ratings and the grader's totals is 0.72, and 0.76 with
  the grader's visual line. Variant averages by the user: A 8.5, D 8.5, C 7, B 5.5, E 4.5. Under
  the user's ratings D ties A in both rounds, so the hold verdict is the same. The one large
  disagreement is r2-E: grader 32/40 (no bugs found), user 3/10 ("has everything however it looks
  ugly, no motion, everything is static"). The user weighs look and motion more than the grader,
  which judged static screenshots. The user's note on r2-A: "loved it however no sounds".

**Caveats.**
- Grading pass 3 had one extra line in its brief (trace suspected bugs and weigh how likely a user
  is to hit them). It found a real bug that passes 1 and 2 and all outside checks missed. In r1-E,
  `startGame()` never resets `solved`, so after any solved puzzle the two-player board stays locked
  (`canInteract` requires `!solved`). The lead reproduced it in the real build (control r1-A
  fine; screenshots `.playwright/2026-11-07-chess-trainer/verify/`).
- The graders' "defender reply timer never cancelled" race (r1-B, r2-B, r1-E, r2-C; all A and D builds clear their timers) needs
  a puzzle switch within about 0.5 s. It is plausible from the code but was not reproduced.
- Two rounds of one task: Sonnet-only variants swung 5–6 points between rounds.

**Routing suggestion (the user decides):**
- Keep Opus for UI and visual work. This is confirmed: visual was the main gap, and no Sonnet
  variant passed the hold rule.
- Prefer the D split (Opus lead plus a Sonnet `editor` for the specifiable engine) over Opus
  alone when a ~1-point drop is fine. It saves only about 9%, so the win is modest.
- A Sonnet checklist pass does not stand in for Opus. Drop it as a quality step for UI builds.
- Haiku `reader`s for summarising a brief: safe, but not worth adding for small inputs.
- Research-first on Sonnet: no measured gain on this task.
- Grading: add the pass-3 instruction to every grading brief, since it was the only pass that
  found a user-facing bug.

Verdict: Chess trainer, 2 rounds x 5 variants, 3 blind Opus passes + blind user rating: Opus solo (A) best 36.5/40; Opus lead + Sonnet editor + Haiku readers (D) holds at 35.5 and ~9% cheaper; Sonnet solo / +checklist / research-first (B/C/E) 29.5-30, lose on visual. User agrees (Spearman 0.72, same winner r2-A). Keep Opus for UI.
