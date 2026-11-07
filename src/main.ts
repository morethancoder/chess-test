import {
  START_FEN, inCheck, kingSquare, legalMoves, newGame, play, resultText, sqIndex, sqName, uci,
  type Game, type Move, type Promo,
} from "./engine.ts";
import { PIECE_NAMES, pieceSvg } from "./pieces.ts";
import "./style.css";

interface PuzzleDef { id: number; type: string; fen: string; solution: string[] }

type Mode = "game" | "puzzle";

const app = document.getElementById("app")!;

let mode: Mode = "game";
let game: Game = newGame();
let selected: number | null = null;
let promotion: { from: number; to: number } | null = null;
let notice = "";
let flash: number | null = null; // square flagged as a wrong move
let puzzles: PuzzleDef[] = [];
let puzzleIdx = 0;
let solIdx = 0; // next solution move index
let solved = false;
let busy = false; // computer reply pending
let flipped = false;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ setup

function startGame(fen: string = START_FEN) {
  mode = "game";
  try {
    game = newGame(fen);
    notice = "";
  } catch {
    game = newGame();
    notice = "That FEN could not be read, so a new game was started.";
  }
  resetTransient();
  flipped = false;
  syncUrl();
  render();
}

function openPuzzle(n: number) {
  if (!puzzles.length) return;
  puzzleIdx = ((n - 1) % puzzles.length + puzzles.length) % puzzles.length;
  const p = puzzles[puzzleIdx];
  mode = "puzzle";
  game = newGame(p.fen);
  solIdx = 0;
  solved = false;
  busy = false;
  notice = "";
  resetTransient();
  flipped = game.position.turn === "b";
  syncUrl();
  render();
}

function resetTransient() {
  selected = null;
  promotion = null;
  flash = null;
  solved = false;
  busy = false;
}

function syncUrl() {
  const url = new URL(location.href);
  url.search = "";
  if (mode === "puzzle") url.searchParams.set("puzzle", String(puzzleIdx + 1));
  history.replaceState(null, "", url);
}

// ------------------------------------------------------------ moves

function targetsFor(from: number): Move[] {
  return legalMoves(game.position).filter((m) => m.from === from);
}

function isPromotion(from: number, to: number) {
  return targetsFor(from).some((m) => m.to === to && m.promo);
}

/** Entry point for a human move attempt (from tap or drag). */
function attempt(from: number, to: number) {
  if (!targetsFor(from).some((m) => m.to === to)) return;
  if (isPromotion(from, to)) {
    promotion = { from, to };
    render();
    return;
  }
  commit({ from, to });
}

function commit(m: Move) {
  selected = null;
  promotion = null;
  flash = null;
  if (mode === "game") {
    const next = play(game, m);
    if (next) game = next;
    render();
    return;
  }
  puzzleMove(m);
}

function puzzleMove(m: Move) {
  const p = puzzles[puzzleIdx];
  const expected = p.solution[solIdx];
  const next = play(game, m);
  if (!next) return render();
  const ok = uci(m) === expected || next.result?.kind === "checkmate";
  if (!ok) {
    flash = m.to;
    notice = "Not the right move — try again.";
    render();
    return;
  }
  game = next;
  solIdx++;
  notice = "";
  if (next.result?.kind === "checkmate" || solIdx >= p.solution.length) {
    solved = true;
    render();
    return;
  }
  // defender's reply plays automatically
  busy = true;
  render();
  void (async () => {
    await wait(450);
    const reply = p.solution[solIdx];
    const rm = legalMoves(game.position).find((l) => uci(l) === reply);
    if (rm) {
      const after = play(game, rm);
      if (after) game = after;
    }
    solIdx++;
    busy = false;
    if (solIdx >= p.solution.length || game.result?.kind === "checkmate") solved = true;
    render();
  })();
}

function canMove(): boolean {
  if (game.result || promotion || busy) return false;
  return mode === "game" || !solved;
}

// ------------------------------------------------------------ rendering

function statusLine(): string {
  if (mode === "puzzle") {
    if (solved) return "Puzzle solved!";
    if (busy) return "Opponent replies…";
    const side = game.position.turn === "w" ? "White" : "Black";
    return notice || `${side} to move — find the ${puzzles[puzzleIdx].type === "mate-in-1" ? "mate in 1" : "mate in 2"}.`;
  }
  if (game.result) return resultText(game.result);
  const side = game.position.turn === "w" ? "White" : "Black";
  return `${side} to move${inCheck(game.position) ? " — check!" : ""}`;
}

function boardHtml(): string {
  const pos = game.position;
  const legal = selected !== null ? targetsFor(selected) : [];
  const targets = new Set(legal.map((m) => m.to));
  const checkSq = inCheck(pos) ? kingSquare(pos.board, pos.turn) : -1;
  let html = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = flipped ? row : 7 - row;
      const file = flipped ? 7 - col : col;
      const i = rank * 8 + file;
      const pc = pos.board[i];
      const cls = ["sq", (rank + file) % 2 === 0 ? "dark" : "light"];
      if (i === selected) cls.push("selected");
      if (game.last && (i === game.last.from || i === game.last.to)) cls.push("last");
      if (i === checkSq) cls.push("check");
      if (i === flash) cls.push("wrong");
      if (targets.has(i)) cls.push(pc ? "capture" : "target");
      const label = pc ? `${sqName(i)} ${pc[0] === "w" ? "white" : "black"} ${PIECE_NAMES[pc[1]]}` : sqName(i);
      const coord =
        (col === 0 ? `<span class="coord rank">${rank + 1}</span>` : "") +
        (row === 7 ? `<span class="coord file">${"abcdefgh"[file]}</span>` : "");
      html += `<div class="${cls.join(" ")}" data-square="${sqName(i)}" role="button" aria-label="${label}">${coord}${
        pc ? `<div class="piece" data-piece="${pc}">${pieceSvg(pc)}</div>` : ""
      }</div>`;
    }
  }
  return html;
}

function promotionHtml(): string {
  const c = game.position.turn;
  const opts: [Promo, string][] = [["q", "Queen"], ["r", "Rook"], ["b", "Bishop"], ["n", "Knight"]];
  return `<div class="overlay"><div class="dialog" role="dialog" aria-label="Choose promotion piece">
    <p>Promote to</p><div class="promo-row" data-testid="promotion">${opts
      .map(([k, name]) => `<button type="button" data-piece="${k}" aria-label="${name}">${pieceSvg((c + k.toUpperCase()) as never)}</button>`)
      .join("")}</div>
    <button type="button" class="link" data-action="cancel-promo">Cancel</button></div></div>`;
}

function render() {
  const showOver = mode === "game" && game.result;
  app.innerHTML = `
  <main>
    <header>
      <h1>Chess trainer</h1>
      <nav class="tabs" aria-label="Mode">
        <button type="button" data-action="mode-game" aria-pressed="${mode === "game"}">Two players</button>
        <button type="button" data-action="mode-puzzle" aria-pressed="${mode === "puzzle"}">Puzzles</button>
      </nav>
    </header>
    <p class="status" role="status" data-testid="status">${statusLine()}</p>
    ${mode === "puzzle" ? `<div class="puzzle-bar">
        <button type="button" data-action="prev" aria-label="Previous puzzle">‹</button>
        <span>Puzzle ${puzzleIdx + 1} of ${puzzles.length} · ${puzzles[puzzleIdx].type}</span>
        <button type="button" data-action="next" aria-label="Next puzzle">›</button>
      </div>` : ""}
    <div class="board-wrap">
      <div class="board" data-testid="board">${boardHtml()}</div>
      ${promotion ? promotionHtml() : ""}
      ${showOver ? `<div class="overlay"><div class="dialog" data-testid="game-over" role="alertdialog">
          <h2>Game over</h2><p>${resultText(game.result!)}</p>
          <button type="button" data-action="new-game">New game</button></div></div>` : ""}
      ${mode === "puzzle" && solved ? `<div class="overlay"><div class="dialog" data-testid="puzzle-solved" role="alertdialog">
          <h2>Solved ✓</h2><p>Checkmate — well done.</p>
          <button type="button" data-action="next">${puzzleIdx + 1 >= puzzles.length ? "Back to puzzle 1" : "Next puzzle"}</button></div></div>` : ""}
    </div>
    <footer>
      ${mode === "game" ? `<button type="button" data-action="new-game">New game</button>` : `<button type="button" data-action="restart">Restart puzzle</button>`}
      ${notice && mode === "game" ? `<p class="notice">${notice}</p>` : ""}
    </footer>
  </main>`;
}

// ------------------------------------------------------------ input

const squareOf = (el: Element | null): number | null => {
  const s = el?.closest<HTMLElement>("[data-square]")?.dataset.square;
  return s ? sqIndex(s) : null;
};

let press: {
  from: number; wasSelected: boolean; startX: number; startY: number;
  dragging: boolean; ghost: HTMLElement | null; origin: HTMLElement | null; id: number;
} | null = null;

app.addEventListener("pointerdown", (e) => {
  const target = e.target as Element;
  if (!target.closest(".board") || e.button > 0) return;
  const sq = squareOf(target);
  if (sq === null || !canMove()) return;
  const pc = game.position.board[sq];
  if (selected !== null && targetsFor(selected).some((m) => m.to === sq)) {
    const from = selected;
    e.preventDefault();
    attempt(from, sq);
    return;
  }
  if (pc && pc[0] === game.position.turn) {
    const wasSelected = selected === sq;
    selected = sq;
    render();
    const origin = app.querySelector<HTMLElement>(`[data-square="${sqName(sq)}"] .piece`);
    press = { from: sq, wasSelected, startX: e.clientX, startY: e.clientY, dragging: false, ghost: null, origin, id: e.pointerId };
  } else if (selected !== null) {
    selected = null;
    render();
  }
});

window.addEventListener("pointermove", (e) => {
  if (!press || e.pointerId !== press.id) return;
  if (!press.dragging) {
    if (Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < 6 || !press.origin) return;
    press.dragging = true;
    const rect = press.origin.getBoundingClientRect();
    const ghost = press.origin.cloneNode(true) as HTMLElement;
    ghost.classList.add("ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    press.ghost = ghost;
    press.origin.style.opacity = "0.25";
  }
  const g = press.ghost!;
  g.style.left = `${e.clientX - g.offsetWidth / 2}px`;
  g.style.top = `${e.clientY - g.offsetHeight / 2}px`;
});

function endPress(e: PointerEvent, cancelled: boolean) {
  if (!press || e.pointerId !== press.id) return;
  const p = press;
  press = null;
  p.ghost?.remove();
  if (p.origin) p.origin.style.opacity = "";
  if (p.dragging) {
    const to = cancelled ? null : squareOf(document.elementFromPoint(e.clientX, e.clientY));
    if (to !== null && to !== p.from) attempt(p.from, to);
  } else if (p.wasSelected && !cancelled) {
    selected = null;
    render();
  }
}
window.addEventListener("pointerup", (e) => endPress(e, false));
window.addEventListener("pointercancel", (e) => endPress(e, true));

app.addEventListener("dragstart", (e) => e.preventDefault());

app.addEventListener("click", (e) => {
  const t = e.target as Element;
  const promoBtn = t.closest<HTMLElement>("[data-testid=promotion] button[data-piece]");
  if (promoBtn && promotion) {
    commit({ ...promotion, promo: promoBtn.dataset.piece as Promo });
    return;
  }
  const action = t.closest<HTMLElement>("[data-action]")?.dataset.action;
  switch (action) {
    case "cancel-promo": promotion = null; selected = null; render(); break;
    case "new-game": startGame(); break;
    case "mode-game": startGame(); break;
    case "mode-puzzle": openPuzzle(puzzleIdx + 1); break;
    case "restart": openPuzzle(puzzleIdx + 1); break;
    case "next": openPuzzle(puzzleIdx + 2); break;
    case "prev": openPuzzle(puzzleIdx); break;
  }
});

// ------------------------------------------------------------ boot

async function boot() {
  const params = new URLSearchParams(location.search);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
    puzzles = await res.json();
  } catch {
    puzzles = [];
  }
  const pz = params.get("puzzle");
  const fen = params.get("fen");
  if (pz && puzzles.length && Number.isFinite(Number(pz))) {
    openPuzzle(Math.max(1, Math.floor(Number(pz))));
  } else if (fen) {
    startGame(fen);
  } else {
    startGame();
  }
}
void boot();
