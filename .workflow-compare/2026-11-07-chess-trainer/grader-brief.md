# Blind grading brief

Ten builds of the same app were made from the same brief. They are labelled with letters in
random order. Grade each one on its own merits and against the others. Nothing tells you how a
build was made, and that should not matter: judge only what is in the folder.

## Read first

- `brief.md`: what was asked.
- `checklist.md`: the 24 lines a build must meet (numbers match the brief).

## Per label (`<label>/`)

- `diff.patch`: everything the build added on top of a shared starter (index.html stub, vite
  config, puzzles.json). This is the code to judge.
- `checks.md`: results of outside checks run on the build after it finished (perft counts,
  rule positions, puzzle file use, scripts, console errors). The builder never saw these.
- `sheet-phone.png`: the five screens (start, midgame, solved puzzle, promotion picker,
  checkmate) at 390 px, light row then dark row.
- `sheet-desktop-light.png`, `sheet-desktop-dark.png`: the same five screens at 1280 px.
- `shots/`: the 20 single screenshots, if a sheet is too small to judge a detail.

The screenshots were taken by one outside script for all builds, through the same
`?fen=` / `?puzzle=` parameters, so the screens are comparable.

## Scores, integers 1 to 10

- `correctness`: the chess rules and app logic are right. Look for real bugs in the diff
  (move generation, check, castling, en passant, promotion, draws, puzzle flow, drag/tap
  handling), and weigh the outside checks.
- `completeness`: how many of the 24 checklist lines are fully met. List the numbers of the
  lines that are not fully met in `missed`.
- `code_quality`: clear structure, readable and maintainable code, sound tests that would
  catch regressions. More code is not better; unasked extras earn nothing unless they make the
  app better for its user.
- `visual`: how polished, clear and pleasant the UI is at both widths and in both themes:
  layout, hierarchy, board and piece look, states (solved, promotion, game over) and
  legibility. Judge the screens, not the CSS.

Use the whole scale. Two builds may share a score, but say why one is better in the notes.

## Output

Write one JSON file to `<this folder>/grades.json` (use Bash with a heredoc; it is the only
file you write):

```json
{
  "A": {"correctness": 8, "completeness": 9, "code_quality": 7, "visual": 6,
        "missed": [14], "notes": "at most 80 words: the reasons for the scores, naming real bugs with file:line"},
  "...": {},
  "winner": "A"
}
```

Every label in the folder needs an entry. `winner` is the build you would ship to a user.

## Limits

Read-only apart from grades.json. Do not run or install anything. Do not look outside this
folder. Your final reply: under 150 words, the winner and why, and any build you found hard
to call.
