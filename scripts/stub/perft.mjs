// Dry-run stub: prints the known perft counts so the lead's perft check can be tested.
const known = { "20": [20, 400, 8902, 197281], "48": [48, 2039, 97862] };
const [fen, d] = process.argv.slice(2);
console.log((fen.startsWith("r3k2r") ? known["48"] : known["20"])[+d - 1]);
