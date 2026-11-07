import { parseFen, perft } from "../src/engine.ts";

const [fen, depth] = process.argv.slice(2);
console.log(perft(parseFen(fen), Number(depth)));
