import { parseFen, perft } from "./engine.ts";

// Run by Node directly (`npm run perft`); no @types/node needed.
declare const process: { argv: string[] };

const [fen, depth] = process.argv.slice(2);
console.log(perft(parseFen(fen), Number(depth)));
