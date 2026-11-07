import { START_FEN, applyMove, legalMoves, outcome, parseFen, positionKey } from "./engine.ts";
import type { Move, Outcome, Position } from "./engine.ts";

/** A game in progress: current position, move list, and repetition bookkeeping. */
export class Game {
  position: Position;
  keys: string[];
  lastMove: Move | null = null;
  result: Outcome;
  moveCount = 0;

  constructor(fen: string = START_FEN) {
    this.position = parseFen(fen);
    this.keys = [positionKey(this.position)];
    this.result = outcome(this.position, this.keys);
  }

  /** Plays a legal move; returns false (and changes nothing) otherwise. */
  play(m: Move): boolean {
    if (this.result.over) return false;
    const ok = legalMoves(this.position).some((x) => x.from === m.from && x.to === m.to && x.promo === m.promo);
    if (!ok) return false;
    this.position = applyMove(this.position, m);
    this.keys.push(positionKey(this.position));
    this.lastMove = { from: m.from, to: m.to };
    this.moveCount++;
    this.result = outcome(this.position, this.keys);
    return true;
  }
}
