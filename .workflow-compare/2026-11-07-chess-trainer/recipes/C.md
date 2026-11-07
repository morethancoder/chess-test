Build the app described in `brief.md` in this repository. Its numbered items are the requirements; items 19-23 are a fixed interface that outside checks use exactly.

Ground rules:
- No human will answer questions during this build. Where the brief is unclear, choose the most reasonable reading, note it in `NOTES.md`, and go on.
- The dev server port is in `$PORT`. Stop any server you start before you finish.
- Commit your work with git as you go. Finish with everything committed.
- You are done when brief item 24 holds: `npm test`, `npm run e2e` and `npm run build` pass, and the page has no console errors.
- Before you finish, take screenshots of the app with Playwright (390 px and 1280 px wide, light and dark) under `.playwright/`, look at them, and fix what looks wrong.
