// Usage: npm run perft -- "<fen>" <depth>   → prints only the node count.
import { parseFen, perft } from "../src/chess.ts";

const [fen, depthArg] = process.argv.slice(2);
const depth = Number(depthArg);
if (!fen || !Number.isInteger(depth) || depth < 0) {
  process.stderr.write('usage: npm run perft -- "<fen>" <depth>\n');
  process.exit(1);
}
try {
  process.stdout.write(`${perft(parseFen(fen), depth)}\n`);
} catch (e) {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exit(1);
}
