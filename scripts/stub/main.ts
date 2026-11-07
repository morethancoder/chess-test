// Stub app for the dry run only: it meets the brief's fixed interface (items 20-23) without any
// chess rules, so the lead's checks and shots can be tested before a real build exists.
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
type Board = Record<string, string>;
const q = new URLSearchParams(location.search);
let puzzle: { solution: string[] } | null = null;
let board: Board = {};
let sel: string | null = null;
const files = "abcdefgh";

function parse(fen: string): Board {
  const b: Board = {};
  fen.split(" ")[0].split("/").forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) { f += +c; continue; }
      b[files[f] + (8 - i)] = (c === c.toUpperCase() ? "w" : "b") + c.toUpperCase();
      f++;
    }
  });
  return b;
}

function render(msg = "") {
  const app = document.getElementById("app")!;
  let html = `<style>body{margin:0;font-family:system-ui;background:Canvas;color:CanvasText}
    .b{display:grid;grid-template-columns:repeat(8,1fr);width:min(96vw,480px);margin:8px auto}
    .s{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:20px}
    .l{background:#eed}.d{background:#8a6}.x{outline:3px solid orange}
    @media (prefers-color-scheme: dark){.l{background:#999}.d{background:#454}}</style><div class="b">`;
  for (let r = 8; r >= 1; r--) for (let f = 0; f < 8; f++) {
    const sq = files[f] + r, p = board[sq];
    html += `<div class="s ${(f + r) % 2 ? "l" : "d"} ${sel === sq ? "x" : ""}" data-square="${sq}">${p ? `<span data-piece="${p}">${p}</span>` : ""}</div>`;
  }
  app.innerHTML = html + `</div><p style="text-align:center">${msg}</p>`;
}

function move(from: string, to: string) {
  const p = board[from];
  delete board[from];
  board[to] = p;
  if (p[1] === "P" && (to[1] === "8" || to[1] === "1")) {
    render();
    document.getElementById("app")!.insertAdjacentHTML("beforeend",
      `<div data-testid="promotion">${"qrbn".split("").map((x) => `<button data-piece="${x}">${x}</button>`).join("")}</div>`);
    return;
  }
  if (puzzle && from + to === puzzle.solution[0]) return render('<b data-testid="puzzle-solved">Solved</b>');
  if (p === "bQ" && to === "h4") return render('<b data-testid="game-over">Black wins by checkmate</b>');
  render();
}

document.addEventListener("click", (e) => {
  const sq = (e.target as HTMLElement).closest("[data-square]")?.getAttribute("data-square");
  if (!sq) return;
  if (sel && sel !== sq) { const f = sel; sel = null; move(f, sq); }
  else { sel = board[sq] ? sq : null; render(); }
});

(async () => {
  if (q.get("puzzle")) {
    const all = await (await fetch("/puzzles.json")).json();
    puzzle = all[+q.get("puzzle")! - 1];
    board = parse(puzzle && "fen" in puzzle ? (puzzle as { fen: string }).fen : START);
  } else board = parse(q.get("fen") || START);
  render();
})();
