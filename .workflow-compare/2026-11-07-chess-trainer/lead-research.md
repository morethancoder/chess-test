# Lead research note: chess-trainer comparison, steps 0–4

**Approved by the user 2026-11-07:** all 17 AC as written, and all nine picks on the decisions
page: fixed interface, lead-supplied puzzles, pre-installed test tools, automatic draws, system
theme, $40 cap, exact Haiku instructions for D, allowlist permissions, vedit row corrected
old → new.

Plan: `~/.claude/skills/workflow-compare/plans/chess-trainer.md`. This note covers what the lead
builds before round 1. Approve or edit by number ("AC 3 ok, drop 9").

## Acceptance criteria

### Step 0: billed pricing

1. `blind.py record` prices each variant from its transcripts: the session `.jsonl` plus its
   `subagents/*.jsonl`, deduped by message id, with input, output, 5 m and 1 h cache writes and
   cache reads priced separately. There is one price table, shared with `agentcost.py`.
2. A `usage.json` part can name a `session` id (headless runs) or a subagent `transcript` path
   (Agent-tool runs such as vedit). The old token-only forms still record, marked "estimate".
3. For headless sessions, `record` compares its price with `total_cost_usd` from the
   `claude -p` JSON result. A gap over 5 % prints a warning and goes into RESULT.md.
4. Re-run on the vedit run's transcripts: its row in `results.md` is corrected with the
   old → new price shown, and its garbled lines are fixed.

### Step 1: project and base commit

5. `~/Demos/chess-test` is a git repo. The **base commit** holds only `brief.md`, `checklist.md`,
   `public/puzzles.json` and a Vite + TypeScript scaffold. The scaffold has vitest and
   `@playwright/test` installed, the scripts `test`, `e2e`, `build` and `dev`, and `dev` serves on
   `$PORT`. The plan said `task.md`, but `task.md` holds the variant recipes, which no build may
   see. It stays in the run folder instead.
6. `puzzles.json` has 12 puzzles (6 mate-in-1, 6 mate-in-2), each with a FEN and its UCI
   solution. python-chess verifies every one before the base commit: the solution mates, and in
   the mate-in-2 puzzles every defence still allows mate.
7. The base commit passes `npm test` and `npm run build` with an empty app.
8. A second commit on `main`, after the base commit, adds `.gitignore` (`node_modules`,
   `.playwright/`, `dist`), the `Makefile` (to `makefile-standards`) and `scripts/`. Builds branch
   from the base commit, so they never see the lead's tooling.
9. This project's memory gets `notes/open-findings.md`, linked from `MEMORY.md`.

### Step 3: brief

10. `brief.md` and `checklist.md` are approved by you, then frozen in the base commit. The drafts
    are next to this note.

### Step 4: lead tooling (scripts, no agent orchestrates)

11. `make launch v=<A..E> r=<1|2>` does the following:
    - creates a worktree from the base commit at `~/Demos/chess-test.wt/r<r>-<v>`, outside the
      repo so a build can't see the run folder or other builds;
    - starts that variant's session(s) with `claude -p --model <m> --output-format json
      --session-id <uuid> --permission-mode acceptEdits --allowedTools <list>` at default effort,
      with no `--fallback-model`;
    - starts C's and D's checklist pass as a second session once the first one ends;
    - writes the session ids, wall time and JSON results to `<run>/r<r>-<v>/usage.json`.
12. The allowlist covers npm, npx, node, git and Playwright inside the worktree, and `Agent`
    (only D uses it). No bypass mode. Denied tool calls are counted per session and reported.
13. A safety cap of `--max-budget-usd 40` per session. Hitting it marks the build "failed: cap",
    and it is not re-run in that round.
14. `make checks v= r=` runs perft (start 1–4, Kiwipete 1–3 through `npm run perft`), then
    `npm test`, `npm run e2e` and `npm run build`. It also loads the page in Playwright and
    records console errors and `scrollWidth > 390` at 390 px. The results go to
    `<run>/r<r>-<v>/checks.md` with pass or fail per line.
15. `make shots v= r=` takes the 20 shots (5 states × 390 / 1280 px × light / dark) by driving
    the real UI through the brief's fixed interface. They are saved as
    `.playwright/<run>/r<r>-<v>/<state>-<width>-<theme>.png`.
16. After each build, `make round` runs launch → checks → shots, and stops with a message when
    one stage fails.
17. Dry run before round 1: the launcher runs on Haiku with a trivial prompt, and checks + shots
    run on a hand-written stub app that meets the fixed interface. All three must work, for
    under $1.

## Open questions (with my answer, change any)

- **Parallel or one by one?** Decided: one by one. AC 11 also pins full model ids and the CLI
  version, and refuses to launch if either changed since the first build.
- **Is a $40 cap per session right?** It's there only to stop a runaway. My estimate for a
  normal build is $5–20.
- **Should the scaffold come with the test tools pre-installed?** Yes, otherwise every build
  picks its own test runner and the checks can't run them all the same way.
- **Should the lead supply the puzzles?** Yes, so every build solves the same 12 and the shot
  script knows the solutions.
- **Do the vedit transcripts still exist?** They're from 2026-11-05, so they should. If they're
  gone, AC 4 shrinks to testing on this run's dry run.
