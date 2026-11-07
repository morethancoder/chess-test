import { Game } from "../src/engine/game.ts";
import { perft } from "../src/engine/perft.ts";

const fen = process.argv[2];
const depth = Number(process.argv[3]);
if (!fen || !Number.isInteger(depth) || depth < 0) {
  console.error('usage: npm run perft -- "<fen>" <depth>');
  process.exit(1);
}
try {
  console.log(perft(new Game(fen), depth));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
