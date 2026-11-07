import { parseFen } from "./board.ts";
import type { Position } from "./board.ts";
import { legalMoves, makeMove, unmakeMove } from "./movegen.ts";
import type { Game } from "./game.ts";

function count(pos: Position, depth: number): number {
  const moves = legalMoves(pos);
  if (depth <= 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    const u = makeMove(pos, m);
    n += count(pos, depth - 1);
    unmakeMove(pos, m, u);
  }
  return n;
}

export function perft(game: Game, depth: number): number {
  if (depth <= 0) return 1;
  return count(parseFen(game.fen()), depth);
}
