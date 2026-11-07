# Checks: r2-Z

Commit `5618eb6`, 2026-11-07 10:08.

| Result | Check | Detail |
|---|---|---|
| FAIL | perft start depth 1 | want 20, got `error` |
| FAIL | perft start depth 2 | want 400, got `error` |
| FAIL | perft start depth 3 | want 8902, got `error` |
| FAIL | perft start depth 4 | want 197281, got `error` |
| FAIL | perft kiwipete depth 1 | want 48, got `error` |
| FAIL | perft kiwipete depth 2 | want 2039, got `error` |
| FAIL | perft kiwipete depth 3 | want 97862, got `error` |
| FAIL | npm run test | exit 0 but no tests ran |
| FAIL | npm run e2e | exit 0 but no tests ran |
| PASS | npm run build |  |
| PASS | console errors | none |
| PASS | no horizontal scroll at 390 px (home) | scrollWidth 390 |
| PASS | no horizontal scroll at 390 px (fen) | scrollWidth 390 |
| PASS | no horizontal scroll at 390 px (puzzle) | scrollWidth 390 |

**5 passed, 9 failed.**
