import "./style.css";
import {
  Game, START_FEN, applyMove, inCheck, kingSquare, legalMoves, parseUci, resultText, sqIndex, sqName, uci,
  type Move, type Piece,
} from "./engine.ts";
import { PIECE_NAMES, pieceSvg } from "./pieces.ts";

interface PuzzleDef {
  id: number;
  type: string;
  fen: string;
  solution: string[];
}

const app = document.querySelector<HTMLDivElement>("#app")!;
let puzzles: PuzzleDef[] = [];

let mode: "game" | "puzzle" = "game";
let game = new Game();
let notice = "";
let startFen = START_FEN;
let selected: number | null = null;
let pendingPromo: { from: number; to: number } | null = null;
let flipped = false;

let puzzleIdx = 0;
let step = 0;
let solved = false;
let busy = false; // waiting for the defender's automatic reply
let wrongSq = -1;
let wrongMsg = "";
let wrongTimer = 0;

// ---------- setup ----------

function startGame(fen?: string) {
  mode = "game";
  notice = "";
  try {
    game = new Game(fen ?? START_FEN);
    startFen = fen ?? START_FEN;
  } catch (e) {
    game = new Game();
    startFen = START_FEN;
    notice = `Could not use that FEN (${(e as Error).message}). Starting a normal game.`;
  }
  resetTransient();
  flipped = false;
}

function startPuzzle(n: number) {
  mode = "puzzle";
  notice = "";
  puzzleIdx = Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 1, 1), puzzles.length) - 1;
  game = new Game(puzzles[puzzleIdx].fen);
  step = 0;
  solved = false;
  resetTransient();
  flipped = game.state.turn === "b";
}

function resetTransient() {
  selected = null;
  pendingPromo = null;
  busy = false;
  wrongSq = -1;
  wrongMsg = "";
  clearTimeout(wrongTimer);
}

function setUrl() {
  const url = new URL(location.href);
  url.search = "";
  if (mode === "puzzle") url.searchParams.set("puzzle", String(puzzleIdx + 1));
  else if (startFen !== START_FEN) url.searchParams.set("fen", startFen);
  history.replaceState(null, "", url);
}

// ---------- moves ----------

function canInteract() {
  return !game.result && !solved && !busy && !pendingPromo;
}

function attempt(from: number, to: number, promo?: Move["promo"]) {
  const options = game.legal().filter((m) => m.from === from && m.to === to);
  if (!options.length) return;
  if (options[0].promo && !promo) {
    pendingPromo = { from, to };
    render();
    return;
  }
  const move: Move = { from, to, promo };
  pendingPromo = null;
  selected = null;
  if (mode === "puzzle") puzzleMove(move);
  else {
    game.play(move);
    render();
  }
}

function puzzleMove(move: Move) {
  const p = puzzles[puzzleIdx];
  const after = applyMove(game.state, move);
  const mates = inCheck(after.board, after.turn) && legalMoves(after).length === 0;
  const last = step === p.solution.length - 1;
  if (uci(move) !== p.solution[step] && !(mates && last)) {
    wrongSq = move.to;
    wrongMsg = "Not the solution — try again.";
    clearTimeout(wrongTimer);
    wrongTimer = window.setTimeout(() => {
      wrongSq = -1;
      render();
    }, 900);
    render();
    return;
  }
  wrongMsg = "";
  wrongSq = -1;
  game.play(move);
  step++;
  if (step >= p.solution.length || game.result?.kind === "checkmate") {
    solved = true;
    render();
    return;
  }
  busy = true;
  render();
  window.setTimeout(() => {
    game.play(parseUci(p.solution[step]));
    step++;
    busy = false;
    render();
  }, 450);
}

// ---------- rendering ----------

const sideName = (c: string) => (c === "w" ? "White" : "Black");

function boardHtml(): string {
  const s = game.state;
  const targets = new Map<number, boolean>();
  if (selected !== null && canInteract()) {
    for (const m of game.legal()) if (m.from === selected) targets.set(m.to, !!s.board[m.to] || (s.board[m.from]![1] === "P" && m.to === s.ep));
  }
  const last = game.lastMove;
  const checkSq = !game.result || game.result.kind === "checkmate" ? (inCheck(s.board, s.turn) ? kingSquare(s.board, s.turn) : -1) : -1;
  let html = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = flipped ? row : 7 - row;
      const file = flipped ? 7 - col : col;
      const i = rank * 8 + file;
      const p = s.board[i];
      const cls = ["sq", (rank + file) % 2 === 0 ? "dark" : "light"];
      if (last && (last.from === i || last.to === i)) cls.push("last");
      if (selected === i) cls.push("selected");
      if (targets.has(i)) cls.push(targets.get(i) ? "capture" : "target");
      if (checkSq === i) cls.push("check");
      if (wrongSq === i) cls.push("wrong");
      const label = `${sqName(i)}${p ? " " + (p[0] === "w" ? "white" : "black") + " " + PIECE_NAMES[p[1]] : ""}`;
      const coord =
        (col === 0 ? `<span class="coord rank">${rank + 1}</span>` : "") +
        (row === 7 ? `<span class="coord file">${"abcdefgh"[file]}</span>` : "");
      html += `<div class="${cls.join(" ")}" data-square="${sqName(i)}" aria-label="${label}">${coord}${
        p ? `<span class="pc" data-piece="${p}">${pieceSvg(p)}</span>` : ""
      }</div>`;
    }
  }
  return html;
}

function promoHtml(): string {
  if (!pendingPromo) return "";
  const color = game.state.turn;
  const names = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };
  return `<div class="promo-backdrop" data-action="cancel-promo"><div class="promo" data-testid="promotion" role="dialog" aria-label="Choose a promotion piece">
    ${(["q", "r", "b", "n"] as const)
      .map((k) => `<button data-action="promote" data-piece="${k}" aria-label="${names[k]}" title="${names[k]}">${pieceSvg((color + k.toUpperCase()) as Piece)}</button>`)
      .join("")}</div></div>`;
}

function statusHtml(): string {
  const s = game.state;
  if (game.result) return `<p class="status">${resultText(game.result)}</p>`;
  const chk = inCheck(s.board, s.turn);
  return `<p class="status"><span class="dot ${s.turn}"></span>${sideName(s.turn)} to move${chk ? ' — <strong class="chk">check</strong>' : ""}</p>`;
}

function panelHtml(): string {
  let html = "";
  if (notice) html += `<p class="notice" role="alert">${notice}</p>`;
  if (mode === "game") {
    html += statusHtml();
    if (game.result) {
      html += `<div class="card result" data-testid="game-over" role="status"><h2>Game over</h2><p>${resultText(game.result)}</p><button class="primary" data-action="new">New game</button></div>`;
    }
    html += `<div class="buttons"><button data-action="new">New game</button><button data-action="undo" ${game.moves.length ? "" : "disabled"}>Undo</button><button data-action="flip">Flip board</button></div>`;
  } else {
    const p = puzzles[puzzleIdx];
    html += `<h2 class="ptitle">Puzzle ${p.id} of ${puzzles.length}<span class="tag">${p.type === "mate-in-1" ? "Mate in 1" : "Mate in 2"}</span></h2>`;
    if (solved) {
      const lastOne = puzzleIdx === puzzles.length - 1;
      html += `<div class="card solved" data-testid="puzzle-solved" role="status"><h2>Solved!</h2><p>Checkmate — well done.</p><button class="primary" data-action="next">${lastOne ? "Back to puzzle 1" : "Next puzzle"}</button></div>`;
    } else {
      const msg = wrongMsg
        ? `<span class="bad">${wrongMsg}</span>`
        : busy
          ? "Defender replies…"
          : `${sideName(game.state.turn)} to move — find the checkmate.`;
      html += `<p class="status" role="status">${msg}</p>`;
    }
    html += `<div class="buttons"><button data-action="reset">Restart</button><button data-action="prev" ${puzzleIdx === 0 ? "disabled" : ""}>Previous</button><button data-action="next" ${solved ? "hidden" : ""}>Skip</button></div>`;
    html += `<div class="chips" aria-label="Choose puzzle">${puzzles
      .map((q, i) => `<button class="chip ${i === puzzleIdx ? "on" : ""}" data-action="goto" data-n="${q.id}" aria-label="Puzzle ${q.id}">${q.id}</button>`)
      .join("")}</div>`;
  }
  return html;
}

function render() {
  app.innerHTML = `
    <header class="top">
      <h1><span class="logo" aria-hidden="true">♞</span> Chess trainer</h1>
      <nav class="tabs" aria-label="Mode">
        <button data-action="mode-game" class="${mode === "game" ? "on" : ""}">Two players</button>
        <button data-action="mode-puzzle" class="${mode === "puzzle" ? "on" : ""}">Puzzles</button>
      </nav>
    </header>
    <main class="layout">
      <section class="board-wrap">
        <div class="board ${canInteract() ? "" : "locked"}" data-testid="board">${boardHtml()}</div>
        ${promoHtml()}
      </section>
      <aside class="panel">${panelHtml()}</aside>
    </main>`;
  setUrl();
}

// ---------- input ----------

const squareOf = (el: Element | null): number | null => {
  const sq = el?.closest<HTMLElement>("[data-square]")?.dataset.square;
  return sq ? sqIndex(sq) : null;
};

interface Press { sq: number; own: boolean; wasSelected: boolean; x: number; y: number; moved: boolean; ghost?: HTMLElement }
let press: Press | null = null;

app.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !canInteract()) return;
  const sq = squareOf(e.target as Element);
  if (sq === null || !(e.target as Element).closest(".board")) return;
  const p = game.state.board[sq];
  const own = !!p && p[0] === game.state.turn;
  press = { sq, own, wasSelected: selected === sq, x: e.clientX, y: e.clientY, moved: false };
  if (own && selected !== sq) {
    selected = sq;
    render();
  }
});

document.addEventListener("pointermove", (e) => {
  if (!press || !press.own) return;
  if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) return;
  if (!press.moved) {
    press.moved = true;
    const el = app.querySelector<HTMLElement>(`[data-square="${sqName(press.sq)}"] .pc`);
    if (!el) return;
    const size = el.getBoundingClientRect().width;
    const ghost = document.createElement("div");
    ghost.className = "ghost";
    ghost.style.width = ghost.style.height = `${size * 1.15}px`;
    ghost.innerHTML = el.innerHTML;
    document.body.append(ghost);
    el.classList.add("lifted");
    press.ghost = ghost;
  }
  const g = press.ghost!;
  const w = parseFloat(g.style.width);
  g.style.transform = `translate(${e.clientX - w / 2}px, ${e.clientY - w / 2}px)`;
});

function endPress(e: PointerEvent, cancelled: boolean) {
  const pr = press;
  press = null;
  if (!pr) return;
  pr.ghost?.remove();
  if (cancelled) { render(); return; }
  if (pr.moved) {
    const to = squareOf(document.elementFromPoint(e.clientX, e.clientY));
    if (to !== null && to !== pr.sq) attempt(pr.sq, to);
    else render();
    return;
  }
  // a tap
  if (pr.own) {
    if (pr.wasSelected) { selected = null; render(); }
  } else if (selected !== null) {
    const from = selected;
    if (game.legal().some((m) => m.from === from && m.to === pr.sq)) attempt(from, pr.sq);
    else { selected = null; render(); }
  }
}
document.addEventListener("pointerup", (e) => endPress(e, false));
document.addEventListener("pointercancel", (e) => endPress(e, true));

app.addEventListener("click", (e) => {
  const el = (e.target as Element).closest<HTMLElement>("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "promote") {
    if (pendingPromo) attempt(pendingPromo.from, pendingPromo.to, el.dataset.piece as Move["promo"]);
    return;
  }
  if (a === "cancel-promo") {
    if (e.target === el) { pendingPromo = null; selected = null; render(); }
    return;
  }
  if (a === "new" || a === "mode-game") startGame();
  else if (a === "mode-puzzle") { if (mode !== "puzzle") startPuzzle(puzzleIdx + 1); }
  else if (a === "undo") { game.undo(); selected = null; }
  else if (a === "flip") flipped = !flipped;
  else if (a === "reset") startPuzzle(puzzleIdx + 1);
  else if (a === "prev") startPuzzle(puzzleIdx);
  else if (a === "next") startPuzzle(((puzzleIdx + 1) % puzzles.length) + 1);
  else if (a === "goto") startPuzzle(Number(el.dataset.n));
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pendingPromo) { pendingPromo = null; selected = null; render(); }
});

// ---------- boot ----------

async function boot() {
  const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
  puzzles = await res.json();
  const q = new URLSearchParams(location.search);
  if (q.has("puzzle")) startPuzzle(Number(q.get("puzzle")));
  else if (q.has("fen")) startGame(q.get("fen")!);
  else startGame();
  render();
}
boot();
