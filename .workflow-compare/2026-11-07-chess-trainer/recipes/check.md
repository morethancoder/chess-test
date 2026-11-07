DRAFT

A previous session built the app in this repository from `brief.md`. Your job is a checklist pass, not a rebuild.

1. Go through `checklist.md` line by line. For each line, check it against the code and the running app (the dev server port is in `$PORT`; Playwright is installed).
2. Where a line is not met, make the smallest change that meets it. Change nothing else: no refactors, restyling or renames outside what a failing line needs.
3. Write `CHECKLIST.md` with one row per line: met / fixed / still failing, and a short note.
4. Finish with `npm test`, `npm run e2e` and `npm run build` passing, every server you started stopped, and your work committed.

No human will answer questions. Where a line is unclear, choose the most reasonable reading and note it in `CHECKLIST.md`.
