import { perft } from '../src/engine/perft.ts';

const [fen, depthArg] = process.argv.slice(2);
const depth = Number(depthArg);
if (!fen || !Number.isInteger(depth) || depth < 0) {
  console.error('usage: npm run perft -- "<fen>" <depth>');
  process.exit(1);
}
console.log(perft(fen, depth));
