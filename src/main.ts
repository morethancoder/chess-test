import "./style.css";
import { START_FEN, findKing, findMove, inCheck, legalMoves, moveToUci, parseUci, sq, sqName, toFen } from "./engine.ts";
import type { Color, Move, PromoType } from "./engine.ts";
import { Game } from "./game.ts";
import { pieceSvg } from "./pieces.ts";

interface Puzzle {
  id: number;
  type: string;
  fen: string;
  solution: string[];
}

type Mode = { kind: "game" } | { kind: "puzzle"; index: number };

const app = document.getElementById("app")!;
let puzzles: Puzzle[] = [];
let mode: Mode = { kind: "game" };
let game = new Game();
let notice = "";
let selected = -1;
let pendingPromo: { from: number; to: number } | null = null;
let step = 0; // index into the puzzle solution of the next move the player must play
let solved = false;
let busy = false; // the defender's reply is about to play
let wrongSquare = -1;
let puzzleMsg = "";
let flip = false;
let timers: number[] = [];

function later(fn: () => void, ms: number) {
  timers.push(window.setTimeout(fn, ms));
}

function setUrl(params: Record<string, string>) {
  const u = new URL(location.href);
  u.search = new URLSearchParams(params).toString();
  history.replaceState(null, "", u);
}

function resetState() {
  for (const t of timers) clearTimeout(t);
  timers = [];
  selected = -1;
  pendingPromo = null;
  step = 0;
  solved = false;
  busy = false;
  wrongSquare = -1;
  puzzleMsg = "";
}

function startGame(fen: string = START_FEN) {
  resetState();
  mode = { kind: "game" };
  try {
    game = new Game(fen);
  } catch (e) {
    notice = "That FEN could not be used (" + (e as Error).message + "). Starting a standard game.";
    game = new Game();
  }
  flip = false;
  render();
}

function startPuzzle(n: number) {
  resetState();
  const count = puzzles.length;
  if (!Number.isInteger(n) || n < 1 || n > count) {
    notice = "No puzzle " + n + ". Showing puzzle 1.";
    n = 1;
  }
  mode = { kind: "puzzle", index: n - 1 };
  game = new Game(puzzles[n - 1].fen);
  flip = game.position.turn === "b";
  setUrl({ puzzle: String(n) });
  render();
}

function currentPuzzle(): Puzzle | null {
  return mode.kind === "puzzle" ? puzzles[mode.index] : null;
}

// ---------- moves ----------

function attemptMove(from: number, to: number, promo?: PromoType) {
  if (busy || solved || game.result.over) return;
  const needsPromo = legalMoves(game.position).some((m) => m.from === from && m.to === to && m.promo);
  if (needsPromo && !promo) {
    pendingPromo = { from, to };
    render();
    return;
  }
  const move = findMove(game.position, from, to, promo);
  if (!move) {
    selected = -1;
    render();
    return;
  }
  pendingPromo = null;
  const pz = currentPuzzle();
  if (!pz) {
    game.play(move);
    selected = -1;
    render();
    return;
  }
  // puzzle: judge the move first
  const last = step >= pz.solution.length - 1;
  let ok: boolean;
  if (last) {
    const probe = new Game(toFen(game.position));
    probe.play(move);
    ok = probe.result.over && probe.result.kind === "checkmate";
  } else {
    ok = moveToUci(move) === pz.solution[step];
  }
  selected = -1;
  if (!ok) {
    wrongSquare = to;
    puzzleMsg = "Not that move — try again.";
    render();
    later(() => {
      wrongSquare = -1;
      render();
    }, 900);
    return;
  }
  wrongSquare = -1;
  game.play(move);
  step++;
  if (last) {
    solved = true;
    puzzleMsg = "";
  } else {
    puzzleMsg = "Good move!";
    busy = true;
    later(() => {
      game.play(parseUci(pz.solution[step]));
      step++;
      busy = false;
      puzzleMsg = "Your move.";
      render();
    }, 600);
  }
  render();
}


// ---------- rendering ----------

const FILES = "abcdefgh";

function boardEl(): HTMLElement {
  const pos = game.position;
  const targets = new Map<number, Move>();
  if (selected >= 0) for (const m of legalMoves(pos)) if (m.from === selected) targets.set(m.to, m);
  const checkSq = inCheck(pos) ? findKing(pos.board, pos.turn) : -1;
  const board = document.createElement("div");
  board.className = "board";
  board.setAttribute("role", "grid");
  board.setAttribute("aria-label", "Chess board");
  const order = [...Array(64).keys()].map((i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return flip ? (row) * 8 + (7 - col) : (7 - row) * 8 + col;
  });
  for (const s of order) {
    const f = s & 7;
    const r = s >> 3;
    const el = document.createElement("div");
    el.dataset.square = sqName(s);
    let cls = "sq " + ((f + r) % 2 === 1 ? "light" : "dark");
    const lm = game.lastMove;
    if (lm && (lm.from === s || lm.to === s)) cls += " last";
    if (s === selected) cls += " selected";
    if (s === checkSq) cls += " check";
    if (s === wrongSquare) cls += " wrong";
    if (targets.has(s)) cls += " target" + (pos.board[s] || (pos.board[selected]![1] === "P" && s === pos.ep) ? " capture" : "");
    el.className = cls;
    // coordinates on the board edges
    const bottomRow = flip ? r === 7 : r === 0;
    const leftCol = flip ? f === 7 : f === 0;
    if (bottomRow) el.insertAdjacentHTML("beforeend", `<span class="coord file">${FILES[f]}</span>`);
    if (leftCol) el.insertAdjacentHTML("beforeend", `<span class="coord rank">${r + 1}</span>`);
    const pc = pos.board[s];
    if (pc) {
      const p = document.createElement("div");
      p.className = "piece";
      p.dataset.piece = pc;
      p.innerHTML = pieceSvg(pc);
      el.appendChild(p);
    }
    board.appendChild(el);
  }
  return board;
}

function colorName(c: Color) {
  return c === "w" ? "White" : "Black";
}

function render() {
  const pos = game.position;
  const pz = currentPuzzle();
  const checked = inCheck(pos);
  const over = game.result.over;

  let status: string;
  let statusCls = "status";
  if (pz) {
    status = solved ? "Solved!" : colorName(pos.turn) + " to move — " + (pz.type === "mate-in-1" ? "mate in 1" : "mate in 2");
  } else if (over) status = "Game over";
  else status = colorName(pos.turn) + " to move";
  if (checked && !over && !solved) {
    status += " — check!";
    statusCls += " check";
  }

  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "app";
  wrap.innerHTML = `
    <header>
      <h1>Chess trainer</h1>
      <div class="tabs">
        <button class="tab" data-action="mode-game" aria-pressed="${!pz}">Two players</button>
        <button class="tab" data-action="mode-puzzle" aria-pressed="${!!pz}">Puzzles</button>
      </div>
    </header>
    <div class="main"><div class="board-wrap"></div><div class="side"></div></div>`;
  app.appendChild(wrap);
  const boardWrap = wrap.querySelector<HTMLElement>(".board-wrap")!;
  boardWrap.appendChild(boardEl());

  if (pendingPromo) {
    const colour = pos.turn;
    const back = document.createElement("div");
    back.className = "promo-backdrop";
    const buttons = (["q", "r", "b", "n"] as const)
      .map(
        (p) =>
          `<button data-piece="${p}" aria-label="Promote to ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[p]}">${pieceSvg((colour + p.toUpperCase()) as never)}</button>`,
      )
      .join("");
    back.innerHTML = `<div class="promo" data-testid="promotion" role="dialog" aria-label="Choose promotion piece"><div>Promote to</div><div class="promo-row">${buttons}</div></div>`;
    boardWrap.appendChild(back);
  }

  const side = wrap.querySelector<HTMLElement>(".side")!;
  const info = document.createElement("div");
  info.className = "panel";
  let html = `<div class="${statusCls}" role="status" aria-live="polite">${status}</div>`;
  if (pz) {
    html += `<div class="sub">Puzzle ${mode.kind === "puzzle" ? mode.index + 1 : 0} of ${puzzles.length}</div>`;
    if (puzzleMsg && !solved) html += `<div class="${puzzleMsg.startsWith("Not") ? "msg-bad" : "msg-good"}">${puzzleMsg}</div>`;
    else if (!solved) html += `<div class="sub">Find the ${pz.type === "mate-in-1" ? "checkmating move" : "forcing sequence that mates in two"}.</div>`;
  } else if (!over) {
    html += `<div class="sub">Pass and play. Tap a piece, then a highlighted square — or drag it.</div>`;
  }
  if (notice) html += `<div class="sub">${notice}</div>`;
  html += `<div class="actions">`;
  if (!pz && over) {
    html += `<button class="btn secondary" data-action="flip">Flip board</button>`;
  } else if (pz) {
    html += `<button class="btn secondary" data-action="restart">Restart puzzle</button>`;
    html += `<button class="btn secondary" data-action="prev">Previous</button>`;
    html += `<button class="btn secondary" data-action="next">Skip</button>`;
  } else {
    html += `<button class="btn secondary" data-action="new">New game</button>`;
    html += `<button class="btn secondary" data-action="flip">Flip board</button>`;
  }
  html += `</div>`;
  info.innerHTML = html;
  side.appendChild(info);

  if (pz && solved) {
    const card = document.createElement("div");
    card.className = "panel result";
    card.dataset.testid = "puzzle-solved";
    card.innerHTML = `<h2 class="msg-good">Puzzle solved ✓</h2><div class="sub">Checkmate — well played.</div><div class="actions"><button class="btn" data-action="next">Next puzzle</button></div>`;
    side.insertBefore(card, info);
  } else if (!pz && over) {
    const card = document.createElement("div");
    card.className = "panel result";
    card.dataset.testid = "game-over";
    card.innerHTML = `<h2>${game.result.over ? game.result.text : ""}</h2><div class="actions"><button class="btn" data-action="new">New game</button></div>`;
    side.insertBefore(card, info);
  }
}

// ---------- input ----------

function squareAt(x: number, y: number): number {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-square]");
  return el ? sq(el.dataset.square!) : -1;
}

let drag: { from: number; startX: number; startY: number; ghost: HTMLElement | null; el: HTMLElement; size: number; wasSelected: boolean } | null = null;

app.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  const target = e.target as HTMLElement;
  if (target.closest(".promo-backdrop")) return;
  const sqEl = target.closest<HTMLElement>("[data-square]");
  if (!sqEl || busy || solved || game.result.over) return;
  const s = sq(sqEl.dataset.square!);
  const pos = game.position;
  // tap on a legal target of the selected piece
  if (selected >= 0 && selected !== s && legalMoves(pos).some((m) => m.from === selected && m.to === s)) {
    attemptMove(selected, s);
    return;
  }
  const pc = pos.board[s];
  if (pc && pc[0] === pos.turn) {
    const pieceEl = sqEl.querySelector<HTMLElement>(".piece")!;
    const wasSelected = selected === s;
    selected = s;
    render();
    const again = app.querySelector<HTMLElement>(`[data-square="${sqName(s)}"] .piece`)!;
    drag = { from: s, startX: e.clientX, startY: e.clientY, ghost: null, el: again, size: pieceEl.getBoundingClientRect().width, wasSelected };
    e.preventDefault();
  } else {
    selected = -1;
    render();
  }
});

window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    const ghost = drag.el.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("data-piece");
    ghost.classList.add("ghost");
    ghost.style.width = ghost.style.height = drag.size + "px";
    document.body.appendChild(ghost);
    drag.el.classList.add("dragging");
    drag.ghost = ghost;
  }
  drag.ghost.style.left = e.clientX - drag.size / 2 + "px";
  drag.ghost.style.top = e.clientY - drag.size / 2 + "px";
});

function endDrag(e: PointerEvent, cancel: boolean) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.ghost) {
    // plain tap on own piece: tapping the already selected piece deselects it
    if (d.wasSelected && !cancel) {
      selected = -1;
      render();
    }
    return;
  }
  d.ghost.remove();
  const to = cancel ? -1 : squareAt(e.clientX, e.clientY);
  if (to >= 0 && to !== d.from && legalMoves(game.position).some((m) => m.from === d.from && m.to === to)) {
    attemptMove(d.from, to);
  } else {
    render();
  }
}
window.addEventListener("pointerup", (e) => endDrag(e, false));
window.addEventListener("pointercancel", (e) => endDrag(e, true));

app.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const promoBtn = t.closest<HTMLElement>(".promo button");
  if (promoBtn && pendingPromo) {
    const { from, to } = pendingPromo;
    attemptMove(from, to, promoBtn.dataset.piece as PromoType);
    return;
  }
  if (t.closest(".promo-backdrop") && !t.closest(".promo")) {
    pendingPromo = null;
    selected = -1;
    render();
    return;
  }
  const action = t.closest<HTMLElement>("[data-action]")?.dataset.action;
  if (!action) return;
  notice = "";
  const idx = mode.kind === "puzzle" ? mode.index + 1 : 1;
  switch (action) {
    case "mode-game":
      setUrl({});
      startGame();
      break;
    case "mode-puzzle":
      startPuzzle(1);
      break;
    case "new":
      setUrl({});
      startGame();
      break;
    case "flip":
      flip = !flip;
      render();
      break;
    case "restart":
      startPuzzle(idx);
      break;
    case "next":
      startPuzzle(idx % puzzles.length + 1);
      break;
    case "prev":
      startPuzzle(idx === 1 ? puzzles.length : idx - 1);
      break;
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    selected = -1;
    pendingPromo = null;
    render();
  }
});

// ---------- boot ----------

async function boot() {
  try {
    const res = await fetch(import.meta.env.BASE_URL + "puzzles.json");
    puzzles = await res.json();
  } catch {
    puzzles = [];
  }
  const params = new URLSearchParams(location.search);
  if (params.has("puzzle") && puzzles.length) {
    startPuzzle(Number(params.get("puzzle")));
  } else if (params.has("fen")) {
    startGame(params.get("fen")!);
  } else {
    startGame();
  }
}

boot();
