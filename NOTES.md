# Notes: readings of unclear points in the brief

- **Puzzle answers:** a move counts as correct if it matches the listed UCI solution move
  or if it gives checkmate on the spot, so another mate in a mate-in-1 also solves it.
  In mate-in-2 puzzles, any other first move is flagged as wrong and taken back.
- **Wrong puzzle move:** the move is shown for a moment with a red highlight and a
  "Try again" message, then taken back so the player can try again right away.
- **Puzzle side:** the board is turned so the side to move is at the bottom.
- **`?fen=` with an invalid FEN:** a notice is shown and a normal game starts from the
  standard position. **`?puzzle=n` out of range:** a notice is shown and puzzle 1 opens.
- **`?puzzle` and `?fen` together:** `?puzzle` wins.
- **Game over:** a modal (`data-testid="game-over"`) shows the result, with "New game"
  and "View board" buttons. In puzzle mode the puzzle-solved banner is shown instead of
  the game-over modal.
- **Draws:** threefold repetition and the 50-move rule end the game on their own, with no
  claim needed. The en passant square only counts toward repetition when an en passant
  capture is actually legal.
- **Perft CLI:** `npm run perft -- "<fen>" <depth>` writes only the count to the
  script's stdout. npm adds its own `> script` banner unless you use `npm run --silent`
  (or `-s`); that banner comes from npm and cannot be turned off from inside the script.
- **Undo** is available in two-player mode only.
