import { parseFen } from './board.ts';
import { perftCount } from './movegen.ts';

export function perft(fen: string, depth: number): number {
  return perftCount(parseFen(fen), depth);
}
