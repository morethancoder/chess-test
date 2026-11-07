// Entry point: the board UI, pass-and-play and puzzle mode.
import "./style.css";
import {
  Game,
  START_FEN,
  describeResult,
  moveToUci,
  parseSquare,
  squareName,
  type Color,
  type Move,
  type PieceType,
} from "./chess.ts";
import { PIECE_NAMES, pieceSvg } from "./pieces.ts";

interface Puzzle {
  id: number;
  type: string;
  fen: string;
  solution: string[];
}
type Mode = "play" | "puzzle";
type Feedback = { kind: "info" | "wrong" | "good"; text: string } | null;

// ---------- state ----------
let mode: Mode = "play";
let playGame = new Game();
let flipped = false;
let puzzles: Puzzle[] = [];
let puzzleError = "";
let notice = "";

const pz = {
  index: 0,
  game: null as Game | null,
  step: 0,
  solved: false,
  feedback: null as Feedback,
  hint: false,
};
const solvedIds = new Set<number>(readSolved());

let selected: number | null = null;
let pendingPromotion: { from: number; to: number } | null = null;
let resultDismissed = false;
let wrongSquares: number[] = [];
let wrongTimer = 0;

const game = (): Game => (mode === "puzzle" && pz.game ? pz.game : playGame);
// The side the puzzle solver plays: whoever moves first in the puzzle FEN.
const puzzleSide = (): Color => (pz.game ? (pz.game.startFen.split(" ")[1] as Color) : "w");
const orientation = (): Color => (mode === "puzzle" && pz.game ? puzzleSide() : flipped ? "b" : "w");

// ---------- DOM skeleton ----------
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="top">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="7" class="bm-bg"/>
        <rect x="8" y="8" width="8" height="8" class="bm-sq"/><rect x="16" y="16" width="8" height="8" class="bm-sq"/>
      </svg>
      <h1>Chess Trainer</h1>
    </div>
    <nav class="tabs" aria-label="Mode">
      <button type="button" class="tab" data-mode="play">Play</button>
      <button type="button" class="tab" data-mode="puzzle">Puzzles</button>
    </nav>
  </header>
  <main class="layout">
    <section class="board-area" aria-label="Board">
      <div class="board-frame">
        <div class="board" id="board"></div>
        <div class="overlay" id="overlay" hidden></div>
      </div>
    </section>
    <aside class="panel" id="panel" aria-live="polite"></aside>
  </main>
`;
const boardEl = document.getElementById("board")!;
const overlayEl = document.getElementById("overlay")!;
const panelEl = document.getElementById("panel")!;
const squareEls = new Map<number, HTMLElement>();
let builtFor: Color | null = null;

function buildBoard(side: Color) {
  boardEl.replaceChildren();
  squareEls.clear();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = side === "w" ? 7 - row : row;
      const file = side === "w" ? col : 7 - col;
      const sq = rank * 8 + file;
      const el = document.createElement("div");
      el.className = `square ${(rank + file) % 2 === 0 ? "dark" : "light"}`;
      el.dataset.square = squareName(sq);
      if (row === 7) el.insertAdjacentHTML("beforeend", `<span class="coord coord-file" aria-hidden="true">${"abcdefgh"[file]}</span>`);
      if (col === 0) el.insertAdjacentHTML("beforeend", `<span class="coord coord-rank" aria-hidden="true">${rank + 1}</span>`);
      boardEl.appendChild(el);
      squareEls.set(sq, el);
    }
  }
  builtFor = side;
}

// ---------- rendering ----------
interface Anim {
  move: Move;
  delay: number;
}

function render(anims: Anim[] = []) {
  const g = game();
  const side = orientation();
  if (builtFor !== side) buildBoard(side);
  const status = g.status();
  const last = g.lastMove();
  const targets = selected !== null ? g.movesFrom(selected) : [];
  const hintFrom = mode === "puzzle" && pz.hint && pz.game && !pz.solved ? pz.game.findUci(puzzles[pz.index].solution[pz.step])?.from : undefined;
  for (const [sq, el] of squareEls) {
    const p = g.pos.board[sq];
    const want = p ? p.color + p.type.toUpperCase() : null;
    let pieceEl = el.querySelector<SVGSVGElement>("svg.piece");
    if ((pieceEl?.getAttribute("data-piece") ?? null) !== want) {
      pieceEl?.remove();
      pieceEl = null;
      if (p) {
        pieceEl = pieceSvg(p.color, p.type, { "data-piece": want! });
        el.appendChild(pieceEl);
      }
    }
    pieceEl?.classList.remove("dragging");
    const target = targets.find((m) => m.to === sq);
    el.classList.toggle("selected", sq === selected);
    el.classList.toggle("last-move", !!last && (last.from === sq || last.to === sq));
    el.classList.toggle("target", !!target && !target.captured);
    el.classList.toggle("capture", !!target && !!target.captured);
    el.classList.toggle("check", status.check && p?.type === "k" && p.color === g.turn);
    el.classList.toggle("wrong", wrongSquares.includes(sq));
    el.classList.toggle("hint", sq === hintFrom);
    el.setAttribute("aria-label", `${squareName(sq)}${p ? `, ${p.color === "w" ? "white" : "black"} ${PIECE_NAMES[p.type]}` : ""}`);
    if (status.check && p?.type === "k" && p.color === g.turn) el.dataset.check = "true";
    else delete el.dataset.check;
  }
  boardEl.classList.toggle("locked", !canInteract());
  renderTabs();
  renderOverlay();
  renderPanel();
  runAnimations(anims);
}

function runAnimations(anims: Anim[]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const { move, delay } of anims) {
    const fromEl = squareEls.get(move.from), toEl = squareEls.get(move.to);
    const piece = toEl?.querySelector<SVGSVGElement>("svg.piece");
    if (!fromEl || !toEl || !piece) continue;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    piece.animate(
      [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "translate(0, 0)" }],
      { duration: 180, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" },
    );
  }
}

function renderTabs() {
  for (const t of document.querySelectorAll<HTMLButtonElement>(".tab")) {
    const on = t.dataset.mode === mode;
    t.classList.toggle("active", on);
    t.setAttribute("aria-pressed", String(on));
  }
}

const sideName = (c: Color) => (c === "w" ? "White" : "Black");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function renderOverlay() {
  const g = game();
  const status = g.status();
  overlayEl.replaceChildren();
  if (pendingPromotion) {
    const color = g.turn;
    const box = document.createElement("div");
    box.className = "card promotion";
    box.dataset.testid = "promotion";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Choose a piece to promote to");
    box.innerHTML = `<p class="card-title">Promote to</p><div class="promo-row"></div><button type="button" class="link" data-action="cancel-promo">Cancel</button>`;
    const row = box.querySelector(".promo-row")!;
    for (const t of ["q", "r", "b", "n"] as PieceType[]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "promo-btn";
      btn.dataset.piece = t;
      btn.setAttribute("aria-label", PIECE_NAMES[t]);
      btn.title = PIECE_NAMES[t];
      btn.appendChild(pieceSvg(color, t));
      row.appendChild(btn);
    }
    overlayEl.appendChild(box);
    overlayEl.hidden = false;
    return;
  }
  if (mode === "puzzle" && pz.solved && !resultDismissed) {
    const p = puzzles[pz.index];
    overlayEl.innerHTML = `
      <div class="card result solved" data-testid="puzzle-solved" role="dialog" aria-label="Puzzle solved">
        <div class="badge good" aria-hidden="true">✓</div>
        <p class="card-title">Solved!</p>
        <p class="card-sub">Puzzle ${p.id} · ${p.type === "mate-in-2" ? "Mate in 2" : "Mate in 1"}</p>
        <div class="card-actions">
          <button type="button" class="btn primary" data-action="next-puzzle">Next puzzle</button>
          <button type="button" class="btn" data-action="dismiss">View board</button>
        </div>
      </div>`;
    overlayEl.hidden = false;
    return;
  }
  if (mode === "play" && status.over && !resultDismissed) {
    const r = describeResult(status);
    const score = status.winner === "w" ? "1-0" : status.winner === "b" ? "0-1" : "½-½";
    overlayEl.innerHTML = `
      <div class="card result" data-testid="game-over" role="dialog" aria-label="Game over">
        <p class="card-title">${r.title}</p>
        <p class="card-sub">${r.detail}</p>
        <p class="score">${score}</p>
        <div class="card-actions">
          <button type="button" class="btn primary" data-action="new">New game</button>
          <button type="button" class="btn" data-action="dismiss">View board</button>
        </div>
      </div>`;
    overlayEl.hidden = false;
    return;
  }
  overlayEl.hidden = true;
}

function moveListHtml(g: Game): string {
  if (!g.history.length) return `<p class="muted small">No moves yet.</p>`;
  const [, turn, , , , full] = g.startFen.split(" ");
  let num = Number(full);
  let html = "";
  let i = 0;
  if (turn === "b") {
    html += `<li><span class="num">${num}.</span><span class="ply">…</span><span class="ply">${esc(g.history[0].san)}</span></li>`;
    i = 1;
    num++;
  }
  for (; i < g.history.length; i += 2, num++) {
    const a = g.history[i].san, b = g.history[i + 1]?.san ?? "";
    html += `<li><span class="num">${num}.</span><span class="ply">${esc(a)}</span><span class="ply">${esc(b)}</span></li>`;
  }
  return `<ol class="moves">${html}</ol>`;
}

function renderPanel() {
  const noticeHtml = notice ? `<p class="notice" role="status">${esc(notice)}</p>` : "";
  if (mode === "play") {
    const g = playGame;
    const s = g.status();
    let statusHtml: string;
    if (s.over) {
      const r = describeResult(s);
      const testid = resultDismissed ? ` data-testid="game-over"` : "";
      statusHtml = `<div class="status over"${testid}><span class="dot ${s.winner ?? "draw"}"></span><strong>${r.title}</strong> · ${r.detail}</div>`;
    } else {
      statusHtml = `<div class="status"><span class="dot ${g.turn}"></span><span><strong>${sideName(g.turn)}</strong> to move</span>${s.check ? ` <span class="pill danger">Check</span>` : ""}</div>`;
    }
    panelEl.innerHTML = `
      ${noticeHtml}
      ${statusHtml}
      <div class="controls">
        <button type="button" class="btn" data-action="new">New game</button>
        <button type="button" class="btn" data-action="undo" ${g.history.length ? "" : "disabled"}>Undo</button>
        <button type="button" class="btn" data-action="flip">Flip board</button>
      </div>
      <h2 class="section">Moves</h2>
      <div class="moves-wrap">${moveListHtml(g)}</div>
      <p class="muted small help">Tap a piece then a highlighted square, or drag it. Pass the device to your opponent after each move.</p>`;
    const wrap = panelEl.querySelector(".moves-wrap");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
    return;
  }
  // puzzle mode
  if (!puzzles.length) {
    panelEl.innerHTML = `${noticeHtml}<p class="muted">${puzzleError ? esc(puzzleError) : "Loading puzzles…"}</p>`;
    return;
  }
  const p = puzzles[pz.index];
  const side = sideName(puzzleSide());
  const moves = p.type === "mate-in-2" ? 2 : 1;
  const fb = pz.feedback;
  const solvedBanner = pz.solved && resultDismissed
    ? `<div class="feedback good" data-testid="puzzle-solved">Solved! <button type="button" class="link" data-action="next-puzzle">Next puzzle →</button></div>`
    : "";
  const grid = puzzles
    .map((q, i) => `<button type="button" class="pz ${i === pz.index ? "current" : ""} ${solvedIds.has(q.id) ? "done" : ""}" data-action="goto" data-index="${i}" aria-label="Puzzle ${q.id}${solvedIds.has(q.id) ? " (solved)" : ""}">${q.id}</button>`)
    .join("");
  panelEl.innerHTML = `
    ${noticeHtml}
    <div class="pz-head">
      <h2 class="pz-title">Puzzle ${p.id} <span class="muted">/ ${puzzles.length}</span></h2>
      <span class="pill">${moves === 1 ? "Mate in 1" : "Mate in 2"}</span>
    </div>
    <div class="status"><span class="dot ${puzzleSide()}"></span>${side} to move and mate in ${moves}.</div>
    ${solvedBanner || (fb ? `<div class="feedback ${fb.kind}">${esc(fb.text)}</div>` : `<div class="feedback info">Find the checkmate.</div>`)}
    <div class="controls pz-controls">
      <button type="button" class="btn" data-action="hint" ${pz.solved ? "disabled" : ""}>Hint</button>
      <button type="button" class="btn" data-action="restart">Restart</button>
      <button type="button" class="btn" data-action="prev-puzzle" aria-label="Previous puzzle">← Prev</button>
      <button type="button" class="btn" data-action="next-puzzle" aria-label="Next puzzle">Next →</button>
    </div>
    <h2 class="section">All puzzles</h2>
    <div class="pz-grid">${grid}</div>`;
}

// ---------- game flow ----------
function canInteract(): boolean {
  if (pendingPromotion) return false;
  if (mode === "puzzle") return !!pz.game && !pz.solved;
  return !playGame.status().over;
}

function select(sq: number | null) {
  selected = sq;
  render();
}

function attemptMove(from: number, to: number, dragged: boolean) {
  const g = game();
  const options = g.movesFrom(from).filter((m) => m.to === to);
  if (!options.length) return;
  if (options.some((m) => m.promotion)) {
    pendingPromotion = { from, to };
    render();
    return;
  }
  commit(options[0], dragged);
}

function commit(m: Move, dragged: boolean) {
  selected = null;
  wrongSquares = [];
  clearTimeout(wrongTimer);
  if (mode === "play") {
    playGame.play(m);
    resultDismissed = false;
    render(dragged ? [] : [{ move: m, delay: 0 }]);
  } else {
    puzzleMove(m, dragged);
  }
}

function puzzleMove(m: Move, dragged: boolean) {
  const g = pz.game!;
  const sol = puzzles[pz.index].solution;
  const isLast = pz.step === sol.length - 1;
  g.play(m);
  const ok = moveToUci(m) === sol[pz.step] || (isLast && g.status().reason === "checkmate");
  if (!ok) {
    g.undo();
    pz.feedback = { kind: "wrong", text: "Not the right move. Try again." };
    flashWrong([m.from, m.to]);
    return;
  }
  pz.step++;
  pz.hint = false;
  const anims: Anim[] = dragged ? [] : [{ move: m, delay: 0 }];
  if (pz.step >= sol.length) {
    pz.solved = true;
    resultDismissed = false;
    pz.feedback = { kind: "good", text: "Checkmate. Solved!" };
    solvedIds.add(puzzles[pz.index].id);
    saveSolved();
  } else {
    // Defender's reply plays automatically.
    const reply = g.findUci(sol[pz.step])!;
    g.play(reply);
    pz.step++;
    pz.feedback = { kind: "good", text: `Good move. ${sideName(reply.color)} replied ${g.history[g.history.length - 1].san}. Now finish it.` };
    anims.push({ move: reply, delay: dragged ? 120 : 260 });
  }
  render(anims);
}

function flashWrong(squares: number[]) {
  wrongSquares = squares;
  clearTimeout(wrongTimer);
  wrongTimer = window.setTimeout(() => {
    wrongSquares = [];
    render();
  }, 900);
  render();
}

function choosePromotion(t: PieceType) {
  if (!pendingPromotion) return;
  const { from, to } = pendingPromotion;
  pendingPromotion = null;
  const m = game().findMove(from, to, t);
  if (m) commit(m, false);
  else render();
}

function newGame(fen?: string) {
  playGame = new Game(fen);
  selected = null;
  pendingPromotion = null;
  resultDismissed = false;
  notice = "";
  setUrl(fen ? { fen } : {});
  render();
}

function openPuzzle(index: number) {
  if (!puzzles.length) return;
  pz.index = ((index % puzzles.length) + puzzles.length) % puzzles.length;
  pz.game = new Game(puzzles[pz.index].fen);
  pz.step = 0;
  pz.solved = false;
  pz.feedback = null;
  pz.hint = false;
  selected = null;
  pendingPromotion = null;
  resultDismissed = false;
  wrongSquares = [];
  mode = "puzzle";
  setUrl({ puzzle: String(pz.index + 1) });
  render();
}

function setMode(m: Mode) {
  if (m === mode) return;
  notice = "";
  selected = null;
  pendingPromotion = null;
  resultDismissed = false;
  if (m === "puzzle") {
    mode = "puzzle";
    if (pz.game) {
      setUrl({ puzzle: String(pz.index + 1) });
      render();
    } else openPuzzle(0);
  } else {
    mode = "play";
    setUrl(playGame.startFen === START_FEN ? {} : { fen: playGame.startFen });
    render();
  }
}

function setUrl(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  history.replaceState(null, "", location.pathname + (q ? `?${q}` : ""));
}

function readSolved(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem("solved-puzzles") ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}
function saveSolved() {
  try {
    localStorage.setItem("solved-puzzles", JSON.stringify([...solvedIds]));
  } catch {
    /* storage unavailable; progress just isn't kept */
  }
}

// ---------- input: tap and drag (pointer events cover mouse, touch and pen) ----------
interface DragState {
  from: number;
  pointerId: number;
  x0: number;
  y0: number;
  started: boolean;
  wasSelected: boolean;
  ghost?: SVGSVGElement;
  over?: HTMLElement | null;
}
let drag: DragState | null = null;

const squareAt = (x: number, y: number): HTMLElement | null =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>("#board [data-square]") ?? null;

boardEl.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const sqEl = (e.target as Element).closest<HTMLElement>("[data-square]");
  if (!sqEl) return;
  e.preventDefault();
  if (!canInteract()) return;
  const sq = parseSquare(sqEl.dataset.square!);
  const g = game();
  if (selected !== null && selected !== sq && g.movesFrom(selected).some((m) => m.to === sq)) {
    attemptMove(selected, sq, false);
    return;
  }
  const p = g.pos.board[sq];
  if (p && p.color === g.turn) {
    const wasSelected = selected === sq;
    if (!wasSelected) select(sq);
    drag = { from: sq, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, started: false, wasSelected };
    return;
  }
  if (selected !== null) select(null);
});

window.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    const src = squareEls.get(drag.from)?.querySelector<SVGSVGElement>("svg.piece");
    if (!src) return;
    drag.started = true;
    const size = squareEls.get(drag.from)!.getBoundingClientRect().width;
    const ghost = src.cloneNode(true) as SVGSVGElement;
    ghost.removeAttribute("data-piece");
    ghost.classList.add("ghost");
    ghost.style.width = ghost.style.height = `${size * 1.1}px`;
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    src.classList.add("dragging");
    document.body.classList.add("is-dragging");
  }
  const ghost = drag.ghost!;
  const half = parseFloat(ghost.style.width) / 2;
  ghost.style.transform = `translate(${e.clientX - half}px, ${e.clientY - half}px)`;
  const over = squareAt(e.clientX, e.clientY);
  if (over !== drag.over) {
    drag.over?.classList.remove("drag-over");
    over?.classList.add("drag-over");
    drag.over = over;
  }
});

function endDrag(e: PointerEvent, cancelled: boolean) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const d = drag;
  drag = null;
  d.over?.classList.remove("drag-over");
  d.ghost?.remove();
  document.body.classList.remove("is-dragging");
  if (d.started) {
    const target = cancelled ? null : squareAt(e.clientX, e.clientY);
    const to = target ? parseSquare(target.dataset.square!) : -1;
    if (to >= 0 && to !== d.from && game().movesFrom(d.from).some((m) => m.to === to)) attemptMove(d.from, to, true);
    else render();
  } else if (d.wasSelected) {
    select(null); // tapping the selected piece again deselects it
  }
}
window.addEventListener("pointerup", (e) => endDrag(e, false));
window.addEventListener("pointercancel", (e) => endDrag(e, true));
boardEl.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- buttons ----------
document.addEventListener("click", (e) => {
  const t = e.target as Element;
  const tab = t.closest<HTMLButtonElement>(".tab");
  if (tab) return setMode(tab.dataset.mode as Mode);
  const promo = t.closest<HTMLButtonElement>(".promo-btn");
  if (promo) return choosePromotion(promo.dataset.piece as PieceType);
  const btn = t.closest<HTMLButtonElement>("[data-action]");
  if (!btn) return;
  switch (btn.dataset.action) {
    case "new":
      return newGame();
    case "undo":
      playGame.undo();
      selected = null;
      resultDismissed = false;
      return render();
    case "flip":
      flipped = !flipped;
      return render();
    case "dismiss":
      resultDismissed = true;
      return render();
    case "cancel-promo":
      pendingPromotion = null;
      return render();
    case "next-puzzle":
      return openPuzzle(pz.index + 1);
    case "prev-puzzle":
      return openPuzzle(pz.index - 1);
    case "goto":
      return openPuzzle(Number(btn.dataset.index));
    case "restart":
      return openPuzzle(pz.index);
    case "hint":
      pz.hint = true;
      pz.feedback = { kind: "info", text: "The highlighted piece makes the next move." };
      return render();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (pendingPromotion) pendingPromotion = null;
  else if (selected !== null) selected = null;
  else return;
  render();
});

// ---------- start-up ----------
async function loadPuzzles() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
    if (!res.ok) throw new Error(String(res.status));
    puzzles = (await res.json()) as Puzzle[];
  } catch {
    puzzleError = "Puzzles could not be loaded.";
  }
}

async function start() {
  const params = new URLSearchParams(location.search);
  const fen = params.get("fen");
  const puzzleParam = params.get("puzzle");
  await loadPuzzles();
  if (puzzleParam !== null && puzzles.length) {
    const n = Number(puzzleParam);
    if (Number.isInteger(n) && n >= 1 && n <= puzzles.length) {
      openPuzzle(n - 1);
    } else {
      openPuzzle(0);
      notice = `There is no puzzle ${puzzleParam}; showing puzzle 1.`;
      render();
    }
    return;
  }
  if (fen) {
    try {
      playGame = new Game(fen);
    } catch (err) {
      notice = `Couldn't use that FEN (${(err as Error).message}). Starting a normal game.`;
      setUrl({});
    }
  }
  render();
}

void start();
