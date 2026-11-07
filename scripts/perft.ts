import { parseFen, perft } from "../src/engine.ts";

const [fen, depth] = process.argv.slice(2);
if (!fen || !depth) {
  console.error('usage: npm run perft -- "<fen>" <depth>');
  process.exit(1);
}
console.log(perft(parseFen(fen), Number(depth)));
