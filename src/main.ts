import "./style.css";
import { Game, START_FEN, kingSquare, parseFen, parseUci, sq, sqName, toFen, uci } from "./chess.ts";
import type { Colour, Move, Promo, Status } from "./chess.ts";
import { PIECE_NAMES, pieceSvg } from "./pieces.ts";

interface Puzzle { id: number; type: string; fen: string; solution: string[] }

const REPLY_DELAY = 450;
const app = document.getElementById("app")!;

let mode: "play" | "puzzle" = "play";
let game = new Game();
let flipped = false;
let selected = -1;
let pendingPromo: { from: number; to: number } | null = null;
let dragFrom = -1;

let puzzles: Puzzle[] = [];
let puzzleIndex = 0;
let puzzleStep = 0;
let puzzleSolved = false;
let puzzleBusy = false; // defender reply pending
let feedback: { text: string; kind: "good" | "bad" | "" } = { text: "", kind: "" };
let replyTimer: number | undefined;
let loadError = "";

const colourName = (c: Colour) => (c === "w" ? "White" : "Black");

function resultText(s: Status): string {
  switch (s.kind) {
    case "checkmate": return `Checkmate — ${colourName(s.winner)} wins`;
    case "stalemate": return "Draw by stalemate";
    case "threefold": return "Draw by threefold repetition";
    case "fifty": return "Draw by the 50-move rule";
    case "insufficient": return "Draw by insufficient material";
    default: return "";
  }
}

function playerColour(): Colour {
  return puzzles[puzzleIndex] ? parseFen(puzzles[puzzleIndex].fen).turn : "w";
}

// ---------- mode / navigation ----------
function startPlay(fen: string = START_FEN, updateUrl = true) {
  clearTimeout(replyTimer);
  mode = "play";
  try { game = new Game(fen); } catch { game = new Game(); }
  flipped = false;
  resetInteraction();
  if (updateUrl) history.replaceState(null, "", fen === START_FEN ? location.pathname : `?fen=${encodeURIComponent(fen)}`);
  render();
}

function openPuzzle(i: number, updateUrl = true) {
  clearTimeout(replyTimer);
  if (!puzzles.length) return;
  puzzleIndex = ((i % puzzles.length) + puzzles.length) % puzzles.length;
  mode = "puzzle";
  const p = puzzles[puzzleIndex];
  game = new Game(p.fen);
  puzzleStep = 0;
  puzzleSolved = false;
  puzzleBusy = false;
  flipped = playerColour() === "b";
  feedback = { text: "", kind: "" };
  resetInteraction();
  if (updateUrl) history.replaceState(null, "", `?puzzle=${puzzleIndex + 1}`);
  render();
}

function resetInteraction() {
  selected = -1;
  pendingPromo = null;
  dragFrom = -1;
}

// ---------- moves ----------
function attemptMove(from: number, to: number) {
  if (game.isPromotion(from, to)) {
    pendingPromo = { from, to };
    selected = from;
    render();
    return;
  }
  commitMove({ from, to });
}

function commitMove(m: Move) {
  pendingPromo = null;
  if (mode === "puzzle") return commitPuzzleMove(m);
  if (game.play(m)) selected = -1;
  render();
}

function commitPuzzleMove(m: Move) {
  const expected = puzzles[puzzleIndex].solution[puzzleStep];
  const isLast = puzzleStep === puzzles[puzzleIndex].solution.length - 1;
  let ok = uci(m) === expected;
  if (!ok && isLast) {
    // any other checkmating move also solves a final step
    const probe = new Game(toFen(game.position));
    ok = probe.play(m) && probe.status().kind === "checkmate";
  }
  selected = -1;
  if (!ok) {
    feedback = { text: "That's not the right move — try again.", kind: "bad" };
    render();
    return;
  }
  game.play(m);
  puzzleStep++;
  if (puzzleStep >= puzzles[puzzleIndex].solution.length) {
    puzzleSolved = true;
    feedback = { text: "", kind: "" };
  } else {
    feedback = { text: "Correct! Waiting for the reply…", kind: "good" };
    puzzleBusy = true;
    replyTimer = window.setTimeout(() => {
      game.play(parseUci(puzzles[puzzleIndex].solution[puzzleStep]));
      puzzleStep++;
      puzzleBusy = false;
      feedback = { text: "Your move.", kind: "" };
      render();
    }, REPLY_DELAY);
  }
  render();
}

function canInteract(): boolean {
  if (game.status().kind !== "playing") return false;
  if (mode === "puzzle" && (puzzleSolved || puzzleBusy)) return false;
  return true;
}

// ---------- board input ----------
function squareAtPoint(x: number, y: number): number {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-square]");
  return el ? sq(el.dataset.square!) : -1;
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  if (pendingPromo || !canInteract()) return;
  const s = squareAtPoint(e.clientX, e.clientY);
  if (s < 0) return;
  const pos = game.position;
  if (selected >= 0 && game.movesFrom(selected).some((m) => m.to === s)) {
    attemptMove(selected, s);
    return;
  }
  const pc = pos.board[s];
  const mine = pc && pc[0] === pos.turn && (mode === "play" || pc[0] === playerColour());
  if (!mine) {
    if (selected >= 0) { selected = -1; render(); }
    return;
  }
  const wasSelected = selected === s;
  selected = s;
  dragFrom = s;
  render();
  startDrag(e, pc, wasSelected);
}

function startDrag(e: PointerEvent, pc: string, wasSelected: boolean) {
  const sx = e.clientX, sy = e.clientY;
  let ghost: HTMLElement | null = null;
  let moved = false;
  const size = (document.querySelector(".sq") as HTMLElement).getBoundingClientRect().width;
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    moved = true;
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "ghost";
      ghost.style.width = ghost.style.height = `${size * 1.1}px`;
      ghost.innerHTML = pieceSvg(pc as never);
      document.body.appendChild(ghost);
    }
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
  };
  const end = (ev: PointerEvent) => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", cancel);
    ghost?.remove();
    const from = dragFrom;
    dragFrom = -1;
    if (moved) {
      const to = squareAtPoint(ev.clientX, ev.clientY);
      if (to >= 0 && to !== from && game.movesFrom(from).some((m) => m.to === to)) {
        attemptMove(from, to);
        return;
      }
      render();
    } else if (wasSelected) {
      selected = -1;
      render();
    } else render();
  };
  const cancel = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", cancel);
    ghost?.remove();
    dragFrom = -1;
    render();
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", cancel);
}

// ---------- rendering ----------
function boardHtml(): string {
  const pos = game.position;
  const last = game.lastMove;
  const status = game.status();
  const checkSq = status.kind === "playing" && status.check || status.kind === "checkmate"
    ? kingSquare(pos.board, pos.turn) : -1;
  const targets = new Map<number, boolean>();
  if (selected >= 0) for (const m of game.movesFrom(selected)) targets.set(m.to, !!pos.board[m.to] || (m.to === pos.ep && pos.board[m.from]![1] === "P"));
  let html = "";
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const rr = flipped ? 7 - r : r;
      const ff = flipped ? 7 - f : f;
      const i = rr * 8 + ff;
      const pc = pos.board[i];
      const cls = ["sq", (rr + ff) % 2 === 0 ? "light" : "dark"];
      if (last && (last.from === i || last.to === i)) cls.push("last");
      if (selected === i) cls.push("selected");
      if (i === checkSq) cls.push("check");
      if (targets.has(i)) cls.push("target");
      if (targets.get(i)) cls.push("capture");
      const label = pc ? `${sqName(i)} ${pc[0] === "w" ? "white" : "black"} ${PIECE_NAMES[pc[1]]}` : sqName(i);
      html += `<div class="${cls.join(" ")}" data-square="${sqName(i)}" aria-label="${label}">`;
      if (f === 0) html += `<span class="coord rank">${8 - rr}</span>`;
      if (r === 7) html += `<span class="coord file">${String.fromCharCode(97 + ff)}</span>`;
      if (pc) html += `<div class="piece${dragFrom === i ? " dragging" : ""}" data-piece="${pc}">${pieceSvg(pc)}</div>`;
      html += `</div>`;
    }
  }
  return html;
}

function promoHtml(): string {
  if (!pendingPromo) return "";
  const c = game.position.turn;
  const buttons = (["q", "r", "b", "n"] as Promo[])
    .map((p) => `<button data-piece="${p}" aria-label="${PIECE_NAMES[p.toUpperCase()]}">${pieceSvg((c + p.toUpperCase()) as never)}</button>`)
    .join("");
  return `<div class="promo-overlay" data-action="cancel-promo"><div class="promo">
    <div class="promo-title">Promote to…</div>
    <div class="promo-buttons" data-testid="promotion" role="dialog" aria-label="Choose promotion piece">${buttons}</div>
    <button class="btn" data-action="cancel-promo">Cancel</button></div></div>`;
}

function panelHtml(): string {
  const s = game.status();
  const turn = game.position.turn;
  if (mode === "play") {
    const over = s.kind !== "playing";
    return `<h2>Two players</h2>
      <div class="status${s.kind === "playing" && s.check ? " check" : ""}" data-testid="status" aria-live="polite">${
        over ? "Game over" : `${colourName(turn)} to move${s.kind === "playing" && s.check ? " — check!" : ""}`}</div>
      ${over ? `<div class="result-card" data-testid="game-over"><strong>${resultText(s)}</strong>
        <button class="btn primary" data-action="new-game">New game</button></div>`
        : `<p class="hint">Pass and play on this device. Tap or drag a piece to move.</p>`}
      <div class="row">${over ? "" : `<button class="btn" data-action="new-game">New game</button>`}
      <button class="btn" data-action="flip">Flip board</button></div>`;
  }
  const p = puzzles[puzzleIndex];
  const nextLabel = puzzleIndex === puzzles.length - 1 ? "Back to puzzle 1" : "Next puzzle";
  const options = puzzles.map((q, i) => `<option value="${i}"${i === puzzleIndex ? " selected" : ""}>Puzzle ${i + 1} (${q.type})</option>`).join("");
  return `<h2>Puzzle ${puzzleIndex + 1} of ${puzzles.length} · ${p.type === "mate-in-1" ? "Mate in 1" : "Mate in 2"}</h2>
    <div class="status${!puzzleSolved && s.kind === "playing" && s.check ? " check" : ""}" data-testid="status">${
      puzzleSolved ? "Solved!" : `${colourName(playerColour())} to move and mate`}</div>
    ${puzzleSolved
      ? `<div class="result-card" data-testid="puzzle-solved"><strong>Puzzle solved — checkmate! ✓</strong>
         <button class="btn primary" data-action="next-puzzle">${nextLabel}</button></div>`
      : `<p class="feedback ${feedback.kind}" data-testid="feedback" aria-live="polite">${feedback.text}</p>`}
    <div class="row">
      <button class="btn" data-action="prev-puzzle">‹ Previous</button>
      <button class="btn" data-action="restart-puzzle">Restart</button>
      <button class="btn" data-action="next-puzzle">Next ›</button></div>
    <select class="btn" data-action="pick-puzzle" aria-label="Choose puzzle">${options}</select>`;
}

function render() {
  const puzzleReady = mode === "play" || puzzles.length > 0;
  app.innerHTML = `<div class="app">
    <h1>Chess trainer</h1>
    <div class="tabs" role="group" aria-label="Mode">
      <button class="tab" data-action="mode-play" aria-pressed="${mode === "play"}">Two players</button>
      <button class="tab" data-action="mode-puzzle" aria-pressed="${mode === "puzzle"}">Puzzles</button>
    </div>
    ${puzzleReady ? `<div class="layout">
      <div class="board-wrap"><div class="board" data-testid="board">${boardHtml()}</div>${promoHtml()}</div>
      <div class="panel">${panelHtml()}</div></div>`
      : `<p>${loadError || "Loading puzzles…"}</p>`}
  </div>`;
  app.querySelector(".board")?.addEventListener("pointerdown", onPointerDown as EventListener);
}

app.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-action], .promo button[data-piece]");
  if (!t) return;
  // clicks inside the dialog must not count as a click on the backdrop
  if (t.classList.contains("promo-overlay") && (e.target as HTMLElement).closest(".promo")) return;
  if (t.matches(".promo button[data-piece]") && pendingPromo) {
    commitMove({ ...pendingPromo, promo: t.dataset.piece as Promo });
    return;
  }
  switch (t.dataset.action) {
    case "new-game": startPlay(); break;
    case "flip": flipped = !flipped; render(); break;
    case "cancel-promo": pendingPromo = null; selected = -1; render(); break;
    case "mode-play": if (mode !== "play") startPlay(); break;
    case "mode-puzzle": if (mode !== "puzzle") void openPuzzleMode(puzzleIndex); break;
    case "next-puzzle": openPuzzle(puzzleIndex + 1); break;
    case "prev-puzzle": openPuzzle(puzzleIndex - 1); break;
    case "restart-puzzle": openPuzzle(puzzleIndex); break;
  }
});
app.addEventListener("change", (e) => {
  const t = e.target as HTMLSelectElement;
  if (t.dataset.action === "pick-puzzle") openPuzzle(Number(t.value));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pendingPromo) { pendingPromo = null; selected = -1; render(); }
});

// ---------- boot ----------
let puzzlePromise: Promise<void> | null = null;
function loadPuzzles(): Promise<void> {
  puzzlePromise ??= fetch("/puzzles.json")
    .then((r) => r.json())
    .then((d: Puzzle[]) => { puzzles = d; })
    .catch(() => { loadError = "Could not load puzzles."; });
  return puzzlePromise;
}

async function openPuzzleMode(i: number, updateUrl = true) {
  await loadPuzzles();
  if (puzzles.length) openPuzzle(i, updateUrl);
  else { mode = "puzzle"; render(); }
}

const params = new URLSearchParams(location.search);
const puzzleParam = params.get("puzzle");
if (puzzleParam !== null) {
  mode = "puzzle";
  render();
  const n = Number.parseInt(puzzleParam, 10);
  void openPuzzleMode(Number.isFinite(n) && n >= 1 ? n - 1 : 0, false);
} else {
  startPlay(params.get("fen") ?? START_FEN, false);
  void loadPuzzles();
}
