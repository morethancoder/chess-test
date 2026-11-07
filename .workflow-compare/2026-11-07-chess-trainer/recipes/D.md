DRAFT

Build the app described in `brief.md` in this repository. Its numbered items are the requirements; items 19-23 are a fixed interface that outside checks use exactly.

Ground rules:
- No human will answer questions during this build. Where the brief is unclear, choose the most reasonable reading, note it in `NOTES.md`, and go on.
- The dev server port is in `$PORT`. Stop any server you start before you finish.
- Commit your work with git as you go. Finish with everything committed.
- You are done when brief item 24 holds: `npm test`, `npm run e2e` and `npm run build` pass, and the page has no console errors.
- Before you finish, take screenshots of the app with Playwright (390 px and 1280 px wide, light and dark) under `.playwright/`, look at them, and fix what looks wrong.

How to split the work (you lead; use the Agent tool with these exact subagent types):
1. `reader` (Haiku) first: have it read `brief.md` and `checklist.md` and return (a) the chess rules the brief requires as a numbered list, (b) the fixed interface (items 19-23) verbatim, (c) the perft positions and expected counts. Use its summary instead of re-reading files where you can.
2. You write a short design spec in `docs/design.md`: module layout, the engine's API (types and functions the UI calls), the visual direction (board, pieces, colours, layout at 390 and 1280 px).
3. `editor` (Sonnet) builds the rules engine and its tests from your spec: brief items 3-9, 16, 17 and 20 (`npm run perft`). Give it the spec's engine section and those items as its acceptance criteria. It does not touch the UI.
4. You build the UI yourself: items 1, 2, 10-15, 21-23, and the e2e tests (item 18).
5. `reader` again for reading jobs only: summarise test or e2e output into failures with `file:line`, and digest a diff (what changed, where) after the editor finishes. Never ask a reader to judge the UI or to check its own work; you judge the UI from your screenshots.
6. Fix failures yourself or send engine failures back to an `editor` with the exact failing output.
