import "./style.css";
import {
  Game, inCheck, legalMoves, moveToUci, findKing, sqIndex, sqName, START_FEN,
  type Move, type Promo, type Color,
} from "./engine.ts";
import { pieceSvg, PIECE_NAMES } from "./pieces.ts";

interface Puzzle { id: number; type: string; fen: string; solution: string[] }

type Mode = "game" | "puzzle";

let mode: Mode = "game";
let game = new Game();
let puzzles: Puzzle[] = [];
let puzzleIdx = 0;
let step = 0;
let solved = false;
let busy = false; // defender reply pending
let selected = -1;
let pendingPromo: Move[] | null = null;
let message = "";
let messageKind: "" | "bad" | "good" = "";
let overDismissed = false;
let fenError = "";
let flipped = false;

const app = document.getElementById("app")!;
app.innerHTML = `
  <main class="shell">
    <header class="top">
      <h1>Chess trainer</h1>
      <nav class="tabs" aria-label="Mode">
        <button id="tab-game" type="button">Two players</button>
        <button id="tab-puzzle" type="button">Puzzles</button>
      </nav>
    </header>
    <section class="play">
      <div class="boardwrap">
        <div id="board" class="board" role="grid" aria-label="Chessboard"></div>
        <div id="overlay"></div>
      </div>
      <aside class="side">
        <div id="status" class="status" role="status" aria-live="polite"></div>
        <div id="puzzlebar" class="puzzlebar"></div>
        <div class="actions">
          <button id="new" type="button">New game</button>
          <button id="flip" type="button">Flip board</button>
        </div>
      </aside>
    </section>
  </main>`;

const boardEl = document.getElementById("board")!;
const overlayEl = document.getElementById("overlay")!;
const statusEl = document.getElementById("status")!;
const puzzleBar = document.getElementById("puzzlebar")!;

const turnName = (c: Color) => (c === "w" ? "White" : "Black");

function setUrl(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  history.replaceState(null, "", q ? `?${q}` : location.pathname);
}

function startGame(fen?: string) {
  mode = "game";
  fenError = "";
  try {
    game = new Game(fen ?? START_FEN);
  } catch {
    fenError = "That FEN could not be read, so a standard game was started.";
    game = new Game();
    fen = undefined;
  }
  selected = -1; pendingPromo = null; message = ""; messageKind = ""; overDismissed = false; flipped = false;
  setUrl(fen && fen !== START_FEN ? { fen } : {});
  render();
}

function openPuzzle(n: number) {
  if (!puzzles.length) return;
  puzzleIdx = ((n - 1 + puzzles.length) % puzzles.length);
  const p = puzzles[puzzleIdx];
  mode = "puzzle";
  game = new Game(p.fen);
  step = 0; solved = false; busy = false; selected = -1; pendingPromo = null;
  message = ""; messageKind = ""; overDismissed = false; fenError = "";
  flipped = game.pos.turn === "b"; // player's side at the bottom
  setUrl({ puzzle: String(puzzleIdx + 1) });
  render();
}

function interactive(): boolean {
  if (pendingPromo || busy) return false;
  if (mode === "puzzle") return !solved;
  return !game.outcome().over;
}

function targetsOf(from: number): Move[] {
  return game.legal().filter((m) => m.from === from);
}

function attempt(from: number, to: number) {
  const ms = targetsOf(from).filter((m) => m.to === to);
  if (!ms.length) return;
  if (ms[0].promo) {
    pendingPromo = ms;
    selected = from;
    render();
    return;
  }
  commit(ms[0]);
}

function commit(m: Move) {
  if (mode === "puzzle") {
    const p = puzzles[puzzleIdx];
    const isLast = step === p.solution.length - 1;
    let ok = moveToUci(m) === p.solution[step];
    if (!ok && isLast) {
      const after = new Game(p.fen);
      // replay the line so far to test for an alternative mating move
      for (let i = 0; i < step; i++) {
        const prev = legalMoves(after.pos).find((x) => moveToUci(x) === p.solution[i]);
        if (prev) after.play(prev);
      }
      after.play(m);
      ok = after.outcome().over && inCheck(after.pos);
    }
    selected = -1; pendingPromo = null;
    if (!ok) {
      message = "Not the move — that doesn't solve it. Try again.";
      messageKind = "bad";
      render();
      flashWrong(m.to);
      return;
    }
    game.play(m);
    step++;
    message = ""; messageKind = "";
    if (step >= p.solution.length) {
      solved = true;
      message = "Solved!"; messageKind = "good";
      render();
      return;
    }
    busy = true;
    message = "Good move…"; messageKind = "good";
    render();
    setTimeout(() => {
      const reply = legalMoves(game.pos).find((x) => moveToUci(x) === p.solution[step]);
      if (reply) game.play(reply);
      step++;
      busy = false;
      message = "";
      messageKind = "";
      if (step >= p.solution.length) solved = true;
      render();
    }, 550);
    return;
  }
  game.play(m);
  selected = -1; pendingPromo = null; message = ""; messageKind = "";
  render();
}

function flashWrong(sq: number) {
  const el = boardEl.querySelector(`[data-square="${sqName(sq)}"]`);
  if (!el) return;
  el.classList.add("wrong");
  setTimeout(() => el.classList.remove("wrong"), 700);
}

// ---------- rendering ----------

function render() {
  const out = game.outcome();
  const lastM = game.last;
  const pos = game.pos;
  const targets = selected >= 0 && interactive() ? targetsOf(selected) : [];
  const targetSet = new Map(targets.map((m) => [m.to, m]));
  const checkSq = inCheck(pos) ? findKing(pos.board, pos.turn) : -1;
  const canMove = interactive();
  let html = "";
  for (let vr = 0; vr < 8; vr++) {
    for (let vf = 0; vf < 8; vf++) {
      const r = flipped ? 7 - vr : vr;
      const f = flipped ? 7 - vf : vf;
      const i = r * 8 + f;
      const name = sqName(i);
      const pc = pos.board[i];
      const cls = ["sq", (r + f) % 2 === 0 ? "light" : "dark"];
      if (i === selected) cls.push("selected");
      if (lastM && (i === lastM.from || i === lastM.to)) cls.push("last");
      if (i === checkSq) cls.push("check");
      const t = targetSet.get(i);
      if (t) cls.push(pc || t.flag === "ep" ? "target-capture" : "target");
      if (canMove && pc && pc[0] === pos.turn) cls.push("own");
      const label = pc ? `${name} ${pc[0] === "w" ? "white" : "black"} ${PIECE_NAMES[pc[1]]}` : name;
      const coord =
        (vf === 0 ? `<span class="coord rank">${8 - r}</span>` : "") +
        (vr === 7 ? `<span class="coord file">${"abcdefgh"[f]}</span>` : "");
      html += `<div class="${cls.join(" ")}" data-square="${name}" role="gridcell" aria-label="${label}">${coord}${pc ? pieceSvg(pc) : ""}</div>`;
    }
  }
  boardEl.innerHTML = html;
  boardEl.classList.toggle("locked", !canMove);

  // status
  let s: string;
  if (out.over && mode === "game") s = out.text;
  else if (mode === "puzzle") {
    const p = puzzles[puzzleIdx];
    s = solved ? "Puzzle solved" : `${turnName(pos.turn)} to move — ${p.type.replace("mate-in-", "mate in ")}`;
  } else s = `${turnName(pos.turn)} to move` + (checkSq >= 0 ? " — check!" : "");
  statusEl.textContent = fenError ? `${s}. ${fenError}` : s;
  statusEl.classList.toggle("in-check", checkSq >= 0 && !out.over);

  // puzzle bar
  document.getElementById("tab-game")!.setAttribute("aria-pressed", String(mode === "game"));
  document.getElementById("tab-puzzle")!.setAttribute("aria-pressed", String(mode === "puzzle"));
  document.getElementById("new")!.style.display = mode === "game" ? "" : "none";
  if (mode === "puzzle" && puzzles.length) {
    const opts = puzzles
      .map((p, k) => `<option value="${k + 1}"${k === puzzleIdx ? " selected" : ""}>Puzzle ${k + 1} · ${p.type.replace("mate-in-", "mate in ")}</option>`)
      .join("");
    puzzleBar.innerHTML = `
      <label class="pz-pick">Puzzle <select id="pz-select">${opts}</select></label>
      <div class="msg ${messageKind}" id="msg">${message}</div>
      <div class="pz-actions">
        <button id="pz-reset" type="button">Restart</button>
        <button id="pz-next" type="button">Next puzzle →</button>
      </div>`;
    document.getElementById("pz-select")!.addEventListener("change", (e) => openPuzzle(Number((e.target as HTMLSelectElement).value)));
    document.getElementById("pz-reset")!.addEventListener("click", () => openPuzzle(puzzleIdx + 1));
    document.getElementById("pz-next")!.addEventListener("click", () => openPuzzle(puzzleIdx + 2));
  } else puzzleBar.innerHTML = "";

  // overlays
  let ov = "";
  if (pendingPromo) {
    const c = pos.turn;
    ov = `<div class="modal" data-testid="promotion" role="dialog" aria-label="Choose promotion piece">
      <div class="card"><p>Promote to</p><div class="promo-row">${(["q", "r", "b", "n"] as Promo[])
        .map((k) => `<button type="button" data-piece="${k}" aria-label="${PIECE_NAMES[k.toUpperCase()]}">${pieceSvg((c + k.toUpperCase()) as never, false)}</button>`)
        .join("")}</div></div></div>`;
  } else if (mode === "puzzle" && solved) {
    ov = `<div class="modal" data-testid="puzzle-solved" role="dialog" aria-label="Puzzle solved">
      <div class="card"><h2>✓ Puzzle solved</h2><p>Checkmate — well found.</p>
      <button type="button" id="solved-next" class="primary">Next puzzle →</button></div></div>`;
  } else if (mode === "game" && out.over && !overDismissed) {
    ov = `<div class="modal" data-testid="game-over" role="dialog" aria-label="Game over">
      <div class="card"><h2>Game over</h2><p class="result">${out.text}</p><p class="score">${out.result}</p>
      <div class="row"><button type="button" id="over-new" class="primary">New game</button>
      <button type="button" id="over-close">View board</button></div></div></div>`;
  }
  overlayEl.innerHTML = ov;
  if (pendingPromo) {
    overlayEl.querySelectorAll<HTMLButtonElement>("[data-piece]").forEach((b) =>
      b.addEventListener("click", () => {
        const promo = b.dataset.piece as Promo;
        const m = pendingPromo!.find((x) => x.promo === promo)!;
        pendingPromo = null;
        commit(m);
      }),
    );
    overlayEl.querySelector(".modal")!.addEventListener("pointerdown", (e) => {
      if (e.target === e.currentTarget) { pendingPromo = null; selected = -1; render(); }
    });
  }
  document.getElementById("solved-next")?.addEventListener("click", () => openPuzzle(puzzleIdx + 2));
  document.getElementById("over-new")?.addEventListener("click", () => startGame());
  document.getElementById("over-close")?.addEventListener("click", () => { overDismissed = true; render(); });
}

// ---------- input: tap and drag ----------

interface Drag { from: number; startX: number; startY: number; active: boolean; ghost: HTMLElement | null; pid: number }
let drag: Drag | null = null;

function squareAt(x: number, y: number): number {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-square]");
  return el ? sqIndex(el.dataset.square!) : -1;
}

boardEl.addEventListener("pointerdown", (e) => {
  if (!interactive() || (e.pointerType === "mouse" && e.button !== 0)) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-square]");
  if (!el) return;
  const i = sqIndex(el.dataset.square!);
  const pc = game.pos.board[i];
  if (selected >= 0 && targetsOf(selected).some((m) => m.to === i)) {
    attempt(selected, i);
    e.preventDefault();
    return;
  }
  if (pc && pc[0] === game.pos.turn) {
    selected = i;
    render();
    drag = { from: i, startX: e.clientX, startY: e.clientY, active: false, ghost: null, pid: e.pointerId };
    e.preventDefault();
  } else if (selected >= 0) {
    selected = -1;
    render();
  }
});

window.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    const src = boardEl.querySelector<HTMLElement>(`[data-square="${sqName(drag.from)}"]`);
    const svg = src?.querySelector<SVGElement>("svg.piece");
    if (!src || !svg) { drag = null; return; }
    const size = src.getBoundingClientRect().width;
    const ghost = svg.cloneNode(true) as unknown as HTMLElement;
    ghost.removeAttribute("data-piece");
    ghost.classList.add("ghost");
    ghost.style.width = ghost.style.height = `${size * 1.15}px`;
    document.body.appendChild(ghost);
    svg.classList.add("dragging");
    drag.ghost = ghost;
    drag.active = true;
  }
  const g = drag.ghost!;
  const w = parseFloat(g.style.width);
  g.style.transform = `translate(${e.clientX - w / 2}px, ${e.clientY - w / 2}px)`;
});

function endDrag(e: PointerEvent, cancelled: boolean) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag;
  drag = null;
  d.ghost?.remove();
  if (!d.active) return;
  boardEl.querySelector("svg.dragging")?.classList.remove("dragging");
  if (cancelled) return;
  const to = squareAt(e.clientX, e.clientY);
  // Dropping on an illegal square just snaps the piece back (it stays selected).
  if (to >= 0 && to !== d.from && targetsOf(d.from).some((m) => m.to === to)) attempt(d.from, to);
}
window.addEventListener("pointerup", (e) => endDrag(e, false));
window.addEventListener("pointercancel", (e) => endDrag(e, true));
boardEl.addEventListener("dragstart", (e) => e.preventDefault());

// ---------- chrome ----------

document.getElementById("tab-game")!.addEventListener("click", () => startGame());
document.getElementById("tab-puzzle")!.addEventListener("click", () => openPuzzle(1));
document.getElementById("new")!.addEventListener("click", () => startGame());
document.getElementById("flip")!.addEventListener("click", () => { flipped = !flipped; render(); });

async function init() {
  const params = new URLSearchParams(location.search);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
    puzzles = await res.json();
  } catch {
    puzzles = [];
  }
  const pz = params.get("puzzle");
  if (pz !== null && puzzles.length) {
    const n = Number(pz);
    openPuzzle(Number.isInteger(n) && n >= 1 && n <= puzzles.length ? n : 1);
  } else startGame(params.get("fen") ?? undefined);
}
void init();
