import { parseFen, perft } from "../src/chess.ts";

const [fen, depth] = process.argv.slice(2);
console.log(perft(parseFen(fen), Number(depth)));
