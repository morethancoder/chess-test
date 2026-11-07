import "./style.css";
import {
  Game,
  START_FEN,
  applyMove,
  colorOf,
  defenderLost,
  moveToUci,
  parseFen,
  parseSquare,
  resultText,
  squareName,
  toSan,
  typeOf,
  type Color,
  type Move,
  type PromoType,
} from "./chess.ts";
import { pieceName, pieceSvg } from "./pieces.ts";

interface Puzzle {
  id: number;
  type: string;
  fen: string;
  solution: string[];
}

type Mode = "play" | "puzzle";

interface PuzzleState {
  index: number; // 0-based
  step: number; // index into solution of the next expected ply
  onTrack: boolean; // still following the listed solution
  solved: boolean;
  wrong: { from: number; to: number; san: string } | null;
  replyTimer: number | null;
  pendingReply: string | null;
}

// ---------- state ----------
let mode: Mode = "play";
let game = new Game();
let playFen = START_FEN;
let selected = -1;
let flipped = false;
let cursor = parseSquare("e2");
let promotion: { from: number; to: number } | null = null;
let overlayDismissed = false;
let notice = "";
let puzzles: Puzzle[] = [];
let puzzle: PuzzleState | null = null;
const solvedIds = loadSolved();

// ---------- DOM skeleton ----------
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="top">
    <h1 class="brand"><span class="brand-mark" aria-hidden="true">${pieceSvg("w", "n")}</span>Chess trainer</h1>
    <nav class="tabs" aria-label="Mode">
      <button type="button" class="tab" data-mode="play">Two players</button>
      <button type="button" class="tab" data-mode="puzzle">Puzzles</button>
    </nav>
  </header>
  <main class="layout">
    <section class="board-area">
      <div class="status" id="status" aria-live="polite"></div>
      <div class="board-frame">
        <div class="board" id="board" tabindex="0" aria-label="Chess board. Use arrow keys and Enter to move."></div>
        <div class="overlay" id="overlay" hidden></div>
      </div>
    </section>
    <aside class="panel" id="panel"></aside>
  </main>`;

const boardEl = document.getElementById("board")!;
const statusEl = document.getElementById("status")!;
const overlayEl = document.getElementById("overlay")!;
const panelEl = document.getElementById("panel")!;

const squareEls: HTMLDivElement[] = [];
for (let sq = 0; sq < 64; sq++) {
  const el = document.createElement("div");
  el.className = `square ${(sq % 8) + (sq >> 3) & 1 ? "light" : "dark"}`;
  el.dataset.square = squareName(sq);
  squareEls.push(el);
  boardEl.appendChild(el);
}

// ---------- helpers ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const sideName = (c: Color) => (c === "w" ? "White" : "Black");
const inputLocked = () => game.status().over || (mode === "puzzle" && (!puzzle || puzzle.solved));

function loadSolved(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem("solved-puzzles") ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveSolved() {
  try {
    localStorage.setItem("solved-puzzles", JSON.stringify([...solvedIds]));
  } catch {
    /* storage unavailable: progress just isn't remembered */
  }
}

function setUrl() {
  const url = new URL(location.href);
  url.search = "";
  if (mode === "puzzle" && puzzle) url.searchParams.set("puzzle", String(puzzle.index + 1));
  else if (playFen !== START_FEN) url.searchParams.set("fen", playFen);
  history.replaceState(null, "", url);
}

// ---------- rendering ----------
function render() {
  renderBoard();
  renderStatus();
  renderOverlay();
  renderPanel();
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  });
}

function renderBoard() {
  const pos = game.pos;
  const status = game.status();
  const last = game.lastMove;
  const targets = new Map<number, boolean>();
  if (selected >= 0) for (const m of game.movesFrom(selected)) targets.set(m.to, !!m.captured);
  const checkSq = status.check ? pos.board.indexOf(pos.turn === "w" ? "K" : "k") : -1;
  const wrong = puzzle?.wrong;

  for (let sq = 0; sq < 64; sq++) {
    const el = squareEls[sq];
    const file = sq & 7;
    const rank = sq >> 3;
    el.style.gridColumn = String((flipped ? 7 - file : file) + 1);
    el.style.gridRow = String((flipped ? rank : 7 - rank) + 1);
    const cls = el.classList;
    cls.toggle("selected", sq === selected);
    cls.toggle("last", !!last && (sq === last.from || sq === last.to));
    cls.toggle("target", targets.has(sq) && !targets.get(sq));
    cls.toggle("capture", targets.get(sq) === true);
    cls.toggle("check", sq === checkSq);
    cls.toggle("wrong", !!wrong && (sq === wrong.from || sq === wrong.to));
    cls.toggle("cursor", sq === cursor);
    if (sq === checkSq) el.dataset.check = "true";
    else delete el.dataset.check;

    const p = pos.board[sq];
    const code = p ? colorOf(p) + typeOf(p).toUpperCase() : "";
    let pieceEl = el.querySelector<HTMLDivElement>(".piece");
    if (pieceEl && pieceEl.dataset.piece !== code) {
      pieceEl.remove();
      pieceEl = null;
    }
    if (p && !pieceEl) {
      pieceEl = document.createElement("div");
      pieceEl.className = "piece";
      pieceEl.dataset.piece = code;
      pieceEl.innerHTML = pieceSvg(colorOf(p), typeOf(p));
      el.appendChild(pieceEl);
    }
    el.setAttribute("aria-label", `${squareName(sq)}${p ? ", " + pieceName(colorOf(p), typeOf(p)) : ""}`);

    // Coordinates along the bottom and left edges (as seen by the viewer).
    const bottom = flipped ? rank === 7 : rank === 0;
    const left = flipped ? file === 7 : file === 0;
    const coords = `${left ? `<span class="coord rank">${rank + 1}</span>` : ""}${bottom ? `<span class="coord file">${"abcdefgh"[file]}</span>` : ""}`;
    let coordWrap = el.querySelector<HTMLSpanElement>(".coords");
    if (!coordWrap) {
      coordWrap = document.createElement("span");
      coordWrap.className = "coords";
      coordWrap.setAttribute("aria-hidden", "true");
      el.prepend(coordWrap);
    }
    if (coordWrap.innerHTML !== coords) coordWrap.innerHTML = coords;
  }
}

function renderStatus() {
  const s = game.status();
  let text: string;
  let tone = "";
  if (mode === "puzzle" && puzzle) {
    if (puzzle.solved) {
      text = "Solved!";
      tone = "good";
    } else if (puzzle.wrong) {
      text = `${puzzle.wrong.san} isn't it — try again`;
      tone = "bad";
    } else if (puzzle.pendingReply) {
      text = "Good move! Waiting for the reply…";
    } else {
      const p = puzzles[puzzle.index];
      text = `${sideName(game.turn)} to move — ${typeLabel(p.type).toLowerCase()}`;
      if (puzzle.step > 0) text = `Good — now finish it. ${sideName(game.turn)} to move`;
    }
  } else if (s.over) {
    text = resultText(s);
    tone = "end";
  } else {
    text = `${sideName(game.turn)} to move${s.check ? " — check!" : ""}`;
    if (s.check) tone = "bad";
  }
  statusEl.className = `status ${tone}`;
  const ended = s.over || !!puzzle?.solved;
  const icon = ended
    ? `<span class="status-icon" aria-hidden="true">${puzzle?.solved || (s.over && s.winner) ? "✓" : "½"}</span>`
    : `<span class="turn-dot ${game.turn}" aria-hidden="true"></span>`;
  statusEl.innerHTML = `${icon}<span>${esc(text)}</span>`;
}

function renderOverlay() {
  let html = "";
  if (promotion) {
    const c = game.turn;
    html = `<div class="card promo" data-testid="promotion" role="dialog" aria-label="Choose promotion piece">
      <p class="card-title">Promote to</p>
      <div class="promo-row">
        ${(["q", "r", "b", "n"] as PromoType[])
          .map((t) => `<button type="button" class="promo-btn" data-piece="${t}" aria-label="${pieceName(c, t)}">${pieceSvg(c, t)}</button>`)
          .join("")}
      </div>
      <button type="button" class="link-btn" data-action="cancel-promo">Cancel</button>
    </div>`;
  } else if (mode === "puzzle" && puzzle?.solved && !overlayDismissed) {
    const last = puzzle.index === puzzles.length - 1;
    html = `<div class="card result" data-testid="puzzle-solved" role="status">
      <div class="badge good" aria-hidden="true">✓</div>
      <p class="card-title">Puzzle ${puzzle.index + 1} solved</p>
      <p class="card-sub">${game.sans.filter((_, i) => i % 2 === 0).join(", ")} — checkmate.</p>
      <div class="card-actions">
        <button type="button" class="btn primary" data-action="next">${last ? "Back to puzzle 1" : "Next puzzle →"}</button>
        <button type="button" class="btn" data-action="dismiss">View board</button>
      </div>
    </div>`;
  } else if (mode === "play" && game.status().over && !overlayDismissed) {
    const s = game.status();
    html = `<div class="card result" data-testid="game-over" role="status">
      <div class="badge ${s.over && s.winner ? "win" : "draw"}" aria-hidden="true">${s.over && s.winner ? "#" : "½"}</div>
      <p class="card-title">${esc(resultText(s))}</p>
      <p class="card-sub">${movesSummary()}</p>
      <div class="card-actions">
        <button type="button" class="btn primary" data-action="new-game">New game</button>
        <button type="button" class="btn" data-action="dismiss">View board</button>
      </div>
    </div>`;
  }
  overlayEl.hidden = !html;
  overlayEl.classList.toggle("light", !promotion);
  if (overlayEl.innerHTML !== html) overlayEl.innerHTML = html;
}

function movesSummary() {
  const n = game.turn === "w" ? game.pos.fullmove - 1 : game.pos.fullmove;
  return n > 0 ? `After ${n} move${n === 1 ? "" : "s"}.` : "Game over.";
}

const typeLabel = (t: string) => t.replace(/^mate-in-(\d+)$/, "Mate in $1");

function renderPanel() {
  if (mode === "play") {
    const rows: string[] = [];
    for (let i = 0; i < game.sans.length; i += 2) {
      const n = Math.floor(i / 2) + game.positions[0].fullmove;
      const startsBlack = game.positions[0].turn === "b";
      if (startsBlack && i === 0) {
        rows.push(`<li><span class="num">${n}.</span><span>…</span><span>${game.sans[0]}</span></li>`);
        i -= 1;
        continue;
      }
      rows.push(`<li><span class="num">${n}.</span><span>${game.sans[i]}</span><span>${game.sans[i + 1] ?? ""}</span></li>`);
    }
    panelEl.innerHTML = `
      <div class="panel-head">
        <h2>Pass and play</h2>
        <p class="muted">Tap or drag a piece. Hand the device over after each move.</p>
      </div>
      ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
      <div class="controls">
        <button type="button" class="btn primary" data-action="new-game">New game</button>
        <button type="button" class="btn" data-action="undo" ${game.moves.length ? "" : "disabled"}>Undo</button>
        <button type="button" class="btn" data-action="flip">Flip board</button>
      </div>
      <h3 class="list-title">Moves</h3>
      ${rows.length ? `<ol class="moves">${rows.join("")}</ol>` : `<p class="muted empty">No moves yet.</p>`}`;
    const list = panelEl.querySelector(".moves");
    if (list) list.scrollTop = list.scrollHeight;
    return;
  }

  if (!puzzle || !puzzles.length) {
    panelEl.innerHTML = `<p class="muted">${notice ? esc(notice) : "Loading puzzles…"}</p>`;
    return;
  }
  const p = puzzles[puzzle.index];
  panelEl.innerHTML = `
    <div class="panel-head">
      <h2>Puzzle ${puzzle.index + 1} <span class="muted">of ${puzzles.length}</span></h2>
      <p class="muted"><span class="pill">${esc(typeLabel(p.type))}</span> ${sideName(parseFen(p.fen).turn)} to play and mate.</p>
    </div>
    ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
    <div class="controls">
      <button type="button" class="btn" data-action="prev" ${puzzle.index === 0 ? "disabled" : ""}>← Prev</button>
      <button type="button" class="btn" data-action="retry">Retry</button>
      <button type="button" class="btn ${puzzle.solved ? "primary" : ""}" data-action="next">Next →</button>
    </div>
    <h3 class="list-title">All puzzles</h3>
    <div class="puzzle-grid">
      ${puzzles
        .map(
          (q, i) => `<button type="button" class="pz ${i === puzzle!.index ? "current" : ""} ${solvedIds.has(q.id) ? "done" : ""}"
            data-action="open" data-index="${i}" aria-label="Puzzle ${i + 1}${solvedIds.has(q.id) ? ", solved" : ""}">${i + 1}</button>`,
        )
        .join("")}
    </div>`;
}

// ---------- game flow ----------
function startPlay(fen = START_FEN) {
  cancelReply();
  mode = "play";
  puzzle = null;
  try {
    game = new Game(fen);
    playFen = fen;
  } catch (e) {
    notice = `That FEN couldn't be read (${(e as Error).message}). Starting from the standard position.`;
    game = new Game();
    playFen = START_FEN;
  }
  selected = -1;
  promotion = null;
  overlayDismissed = false;
  flipped = false;
  setUrl();
  render();
}

async function loadPuzzles(): Promise<boolean> {
  if (puzzles.length) return true;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    puzzles = await res.json();
    return puzzles.length > 0;
  } catch (e) {
    notice = `Puzzles couldn't be loaded (${(e as Error).message}).`;
    return false;
  }
}

async function openPuzzle(index: number) {
  cancelReply();
  mode = "puzzle";
  selected = -1;
  promotion = null;
  render();
  if (!(await loadPuzzles())) return render();
  if (!Number.isInteger(index) || index < 0 || index >= puzzles.length) {
    notice = `There's no puzzle ${index + 1}; showing puzzle 1.`;
    index = 0;
  }
  const p = puzzles[index];
  game = new Game(p.fen);
  puzzle = { index, step: 0, onTrack: true, solved: false, wrong: null, replyTimer: null, pendingReply: null };
  flipped = game.turn === "b";
  overlayDismissed = false;
  selected = -1;
  setUrl();
  render();
}

function cancelReply() {
  if (puzzle?.replyTimer) clearTimeout(puzzle.replyTimer);
  if (puzzle) {
    puzzle.replyTimer = null;
    puzzle.pendingReply = null;
  }
}

/** Plays the defender's reply now (used by its timer, or early if the player acts first). */
function flushReply() {
  if (!puzzle?.pendingReply) return;
  const uci = puzzle.pendingReply;
  cancelReply();
  game.moveUci(uci);
  puzzle.step++;
  render();
}

function tryMove(from: number, to: number) {
  const options = game.movesFrom(from).filter((m) => m.to === to);
  if (!options.length) return false;
  if (options.some((m) => m.promotion)) {
    promotion = { from, to };
    render();
    return true;
  }
  commit(options[0]);
  return true;
}

function commit(m: Move) {
  selected = -1;
  promotion = null;
  if (mode === "puzzle" && puzzle) {
    puzzleMove(m);
  } else {
    game.move(m.from, m.to, m.promotion);
    notice = "";
    overlayDismissed = false;
    cursor = m.to;
  }
  render();
}

function puzzleMove(m: Move) {
  const pz = puzzle!;
  const p = puzzles[pz.index];
  const uci = moveToUci(m);
  const after = applyMove(game.pos, m);
  // Player moves left including this one: in mate-in-2 the first move leaves 1 more.
  const remaining = Math.ceil((p.solution.length - pz.step) / 2);
  const matches = pz.onTrack && p.solution[pz.step] === uci;
  // Any move that still forces mate in time is accepted, not just the listed one.
  if (!matches && !defenderLost(after, remaining - 1)) {
    pz.wrong = { from: m.from, to: m.to, san: sanOf(m) };
    return;
  }
  pz.wrong = null;
  pz.onTrack = matches;
  game.move(m.from, m.to, m.promotion);
  pz.step++;
  cursor = m.to;
  const s = game.status();
  if (s.over) {
    if (s.reason === "checkmate") {
      pz.solved = true;
      solvedIds.add(p.id);
      saveSolved();
    }
    return;
  }
  // Defender's reply: the listed one while on track, otherwise any legal move
  // (every defence loses, which defenderLost checked above).
  const listed = pz.onTrack ? p.solution[pz.step] : undefined;
  const replies = game.legalMoves().map(moveToUci);
  pz.pendingReply = listed && replies.includes(listed) ? listed : replies[0];
  pz.onTrack = pz.onTrack && pz.pendingReply === listed;
  pz.replyTimer = window.setTimeout(flushReply, 450);
}

function sanOf(m: Move) {
  return toSan(game.pos, m);
}

// ---------- input: tap and drag ----------
interface Drag {
  from: number;
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  wasSelected: boolean;
  el: HTMLElement | null;
}
let drag: Drag | null = null;

const squareAt = (x: number, y: number): number => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-square]");
  return el && boardEl.contains(el) ? parseSquare(el.dataset.square!) : -1;
};

function ownPieceAt(sq: number) {
  const p = game.pos.board[sq];
  return !!p && colorOf(p) === game.turn;
}

/** A tap (or Enter) on a square. */
function tapSquare(sq: number) {
  if (promotion) return;
  if (selected >= 0 && sq !== selected && tryMove(selected, sq)) return;
  if (ownPieceAt(sq) && sq !== selected) {
    if (puzzle) puzzle.wrong = null;
    selected = sq;
  } else selected = -1;
  render();
}

boardEl.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || promotion) return;
  flushReply();
  if (inputLocked()) return;
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-square]");
  if (!target) return;
  const sq = parseSquare(target.dataset.square!);
  cursor = sq;
  if (selected >= 0 && sq !== selected && game.movesFrom(selected).some((m) => m.to === sq)) {
    e.preventDefault();
    tryMove(selected, sq);
    return;
  }
  if (!ownPieceAt(sq)) {
    selected = -1;
    render();
    return;
  }
  e.preventDefault();
  const wasSelected = selected === sq;
  selected = sq;
  if (puzzle) puzzle.wrong = null;
  render();
  drag = {
    from: sq,
    pointerId: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    moved: false,
    wasSelected,
    el: squareEls[sq].querySelector<HTMLElement>(".piece"),
  };
  try {
    boardEl.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic pointers can't be captured; dragging still works without it */
  }
});

boardEl.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true;
  if (drag.el) {
    drag.el.classList.add("dragging");
    drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
  }
  const over = squareAt(e.clientX, e.clientY);
  squareEls.forEach((el, i) => el.classList.toggle("drag-over", i === over && over !== drag!.from));
});

function endDrag(e: PointerEvent, cancelled: boolean) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const d = drag;
  drag = null;
  if (boardEl.hasPointerCapture(e.pointerId)) boardEl.releasePointerCapture(e.pointerId);
  squareEls.forEach((el) => el.classList.remove("drag-over"));
  if (d.el) {
    d.el.classList.remove("dragging");
    d.el.style.transform = "";
  }
  if (cancelled) return;
  if (d.moved) {
    const to = squareAt(e.clientX, e.clientY);
    if (to >= 0 && to !== d.from && tryMove(d.from, to)) return;
    render();
  } else if (d.wasSelected) {
    selected = -1;
    render();
  }
}
boardEl.addEventListener("pointerup", (e) => endDrag(e, false));
boardEl.addEventListener("pointercancel", (e) => endDrag(e, true));

boardEl.addEventListener("keydown", (e) => {
  const dirs: Record<string, [number, number]> = {
    ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  };
  if (dirs[e.key]) {
    e.preventDefault();
    let [df, dr] = dirs[e.key];
    if (flipped) [df, dr] = [-df, -dr];
    const f = Math.min(7, Math.max(0, (cursor & 7) + df));
    const r = Math.min(7, Math.max(0, (cursor >> 3) + dr));
    cursor = r * 8 + f;
    render();
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    flushReply();
    if (!inputLocked()) tapSquare(cursor);
  } else if (e.key === "Escape") {
    selected = -1;
    render();
  }
});

// ---------- buttons ----------
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!btn) {
    // Clicking the dimmed area around the promotion picker cancels it.
    if (promotion && e.target === overlayEl) {
      promotion = null;
      render();
    }
    return;
  }
  if (btn.classList.contains("tab")) {
    if (btn.dataset.mode === mode) return;
    notice = "";
    if (btn.dataset.mode === "puzzle") void openPuzzle(firstUnsolved());
    else startPlay();
    return;
  }
  if (btn.classList.contains("promo-btn") && promotion) {
    const t = btn.dataset.piece as PromoType;
    const m = game.movesFrom(promotion.from).find((x) => x.to === promotion!.to && x.promotion === t);
    if (m) commit(m);
    return;
  }
  switch (btn.dataset.action) {
    case "cancel-promo":
      promotion = null;
      render();
      break;
    case "new-game":
      notice = "";
      startPlay();
      break;
    case "undo":
      game.undo();
      selected = -1;
      overlayDismissed = false;
      render();
      break;
    case "flip":
      flipped = !flipped;
      render();
      break;
    case "dismiss":
      overlayDismissed = true;
      render();
      break;
    case "retry":
      notice = "";
      void openPuzzle(puzzle?.index ?? 0);
      break;
    case "prev":
      notice = "";
      void openPuzzle(Math.max(0, (puzzle?.index ?? 0) - 1));
      break;
    case "next":
      notice = "";
      void openPuzzle(((puzzle?.index ?? -1) + 1) % Math.max(puzzles.length, 1));
      break;
    case "open":
      notice = "";
      void openPuzzle(Number(btn.dataset.index));
      break;
  }
});

function firstUnsolved() {
  const i = puzzles.findIndex((p) => !solvedIds.has(p.id));
  return i < 0 ? 0 : i;
}

// ---------- start ----------
const params = new URLSearchParams(location.search);
if (params.has("puzzle")) {
  void openPuzzle(Number(params.get("puzzle")) - 1);
} else if (params.has("fen")) {
  startPlay(params.get("fen")!);
} else {
  startPlay();
}
