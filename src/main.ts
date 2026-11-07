import "./style.css";
import {
  START_FEN, applyMove, inCheck, legalMoves, name, outcome, parseFen, parseUci, repetitionKey, resultText, sq, toFen, toUci,
  type Color, type Move, type Position, type Promo,
} from "./engine.ts";
import { PROMO_LABEL, pieceSvg } from "./pieces.ts";

interface Puzzle {
  id: number;
  type: string;
  fen: string;
  solution: string[];
}

type Mode = "game" | "puzzle";

interface State {
  mode: Mode;
  positions: Position[];
  moves: Move[];
  keys: string[];
  selected: number; // square index or -1
  pending: Move[] | null; // promotion choices awaiting a pick
  flipped: boolean;
  // puzzle
  puzzles: Puzzle[];
  puzzleIndex: number;
  step: number;
  solved: boolean;
  wrong: { from: number; to: number } | null;
  replying: boolean;
  notice: string;
}

const app = document.getElementById("app")!;
const state: State = {
  mode: "game", positions: [], moves: [], keys: [], selected: -1, pending: null, flipped: false,
  puzzles: [], puzzleIndex: 0, step: 0, solved: false, wrong: null, replying: false, notice: "",
};

const cur = () => state.positions[state.positions.length - 1];
const lastMove = () => state.moves[state.moves.length - 1];
const colourName = (c: Color) => (c === "w" ? "White" : "Black");

function startGame(fen: string) {
  state.mode = "game";
  state.positions = [parseFen(fen)];
  state.moves = [];
  state.keys = [repetitionKey(state.positions[0])];
  state.selected = -1;
  state.pending = null;
  state.flipped = false;
  state.notice = "";
  syncUrl();
  render();
}

function startPuzzle(index: number) {
  const n = state.puzzles.length;
  state.mode = "puzzle";
  state.puzzleIndex = ((index % n) + n) % n;
  const p = parseFen(state.puzzles[state.puzzleIndex].fen);
  state.positions = [p];
  state.moves = [];
  state.keys = [repetitionKey(p)];
  state.selected = -1;
  state.pending = null;
  state.step = 0;
  state.solved = false;
  state.wrong = null;
  state.replying = false;
  state.flipped = p.turn === "b";
  state.notice = "";
  syncUrl();
  render();
}

function syncUrl() {
  const url = new URL(location.href);
  url.search = "";
  if (state.mode === "puzzle") url.searchParams.set("puzzle", String(state.puzzleIndex + 1));
  history.replaceState(null, "", url);
}

function gameOutcome() {
  return outcome(cur(), state.keys);
}

function targetsFrom(from: number): Move[] {
  return legalMoves(cur()).filter((m) => m.from === from);
}

function canMove(): boolean {
  if (state.pending) return false;
  if (state.mode === "puzzle") return !state.solved && !state.replying;
  return !gameOutcome().over;
}

function commit(m: Move) {
  const next = applyMove(cur(), m);
  state.positions.push(next);
  state.moves.push(m);
  state.keys.push(repetitionKey(next));
  state.selected = -1;
  state.wrong = null;
}

function tryMove(from: number, to: number) {
  const options = targetsFrom(from).filter((m) => m.to === to);
  if (options.length === 0) return;
  if (options[0].promo) {
    state.pending = options;
    render();
    return;
  }
  playMove(options[0]);
}

function playMove(m: Move) {
  state.pending = null;
  if (state.mode === "game") {
    commit(m);
    render();
    return;
  }
  const puzzle = state.puzzles[state.puzzleIndex];
  const after = applyMove(cur(), m);
  const mates = legalMoves(after).length === 0 && inCheck(after);
  if (toUci(m) === puzzle.solution[state.step] || mates) {
    commit(m);
    state.step += 1;
    if (mates || state.step >= puzzle.solution.length) {
      state.solved = true;
      state.notice = "";
    } else {
      state.replying = true;
      state.notice = "Correct — the defender replies…";
      setTimeout(() => {
        const reply = parseUci(cur(), puzzle.solution[state.step]);
        if (reply) commit(reply);
        state.step += 1;
        state.replying = false;
        state.notice = "";
        render();
      }, 450);
    }
  } else {
    state.wrong = { from: m.from, to: m.to };
    state.selected = -1;
    state.notice = "That's not the solution — try again.";
  }
  render();
}

// ---------- rendering ----------

function statusText(): { text: string; tone: string } {
  const p = cur();
  if (state.mode === "puzzle") {
    if (state.solved) return { text: "Solved!", tone: "good" };
    if (state.wrong) return { text: state.notice, tone: "bad" };
    if (state.notice) return { text: state.notice, tone: "" };
    const kind = state.puzzles[state.puzzleIndex].type === "mate-in-1" ? "Mate in 1" : "Mate in 2";
    return { text: colourName(p.turn) + " to move — " + kind, tone: "" };
  }
  const o = gameOutcome();
  if (o.over) return { text: resultText(o), tone: "" };
  if (state.notice) return { text: state.notice, tone: "bad" };
  return { text: colourName(p.turn) + " to move" + (inCheck(p) ? " — check!" : ""), tone: inCheck(p) ? "bad" : "" };
}

function boardHtml(): string {
  const p = cur();
  const sel = state.selected;
  const targets = sel >= 0 ? targetsFrom(sel) : [];
  const targetSet = new Set(targets.map((m) => m.to));
  const last = lastMove();
  const checked = inCheck(p) ? p.board.indexOf((p.turn + "K") as "wK") : -1;
  let html = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = state.flipped ? row : 7 - row;
      const file = state.flipped ? 7 - col : col;
      const i = rank * 8 + file;
      const cls = ["sq", (rank + file) % 2 === 0 ? "dark" : "light"];
      if (i === sel) cls.push("selected");
      if (last && (i === last.from || i === last.to)) cls.push("last");
      if (i === checked) cls.push("check");
      if (state.wrong && (i === state.wrong.from || i === state.wrong.to)) cls.push("wrong");
      if (targetSet.has(i)) cls.push(p.board[i] || (p.board[sel] && p.board[sel]![1] === "P" && i === p.ep) ? "capture" : "target");
      const piece = p.board[i];
      const coord =
        (col === 0 ? '<span class="rank">' + (rank + 1) + "</span>" : "") +
        (row === 7 ? '<span class="file">' + String.fromCharCode(97 + file) + "</span>" : "");
      html += '<div class="' + cls.join(" ") + '" data-square="' + name(i) + '">' + coord + (piece ? pieceSvg(piece) : "") + "</div>";
    }
  }
  return html;
}

function promotionHtml(): string {
  if (!state.pending) return "";
  const colour = cur().turn;
  const buttons = state.pending
    .map((m) => {
      const k = m.promo as Promo;
      return (
        '<button type="button" data-piece="' + k + '" aria-label="' + PROMO_LABEL[k] + '" title="' + PROMO_LABEL[k] + '">' +
        pieceSvg((colour + k.toUpperCase()) as "wQ").replace(' data-piece="' + colour + k.toUpperCase() + '"', "") +
        "</button>"
      );
    })
    .join("");
  return (
    '<div class="promo-backdrop"><div class="promo" data-testid="promotion" role="dialog" aria-label="Choose promotion piece">' +
    "<p>Promote to</p><div>" + buttons + "</div></div></div>"
  );
}

function sideHtml(): string {
  const st = statusText();
  let html = '<p class="status ' + st.tone + '" role="status" data-testid="status">' + st.text + "</p>";
  if (state.mode === "game") {
    const o = gameOutcome();
    if (o.over) {
      html += '<div class="card result" data-testid="game-over"><strong>' + resultText(o) + '</strong><button type="button" data-action="new">New game</button></div>';
    }
    html +=
      '<div class="actions"><button type="button" data-action="undo"' + (state.moves.length ? "" : " disabled") + ">Undo</button>" +
      '<button type="button" data-action="flip">Flip board</button>' +
      (o.over ? "" : '<button type="button" data-action="new">New game</button>') + "</div>";
  } else {
    const n = state.puzzles.length;
    if (state.solved) {
      const lastOne = state.puzzleIndex === n - 1;
      html +=
        '<div class="card result" data-testid="puzzle-solved"><strong>Puzzle solved!</strong>' +
        '<button type="button" data-action="next-puzzle">' + (lastOne ? "Back to puzzle 1" : "Next puzzle") + "</button></div>";
    }
    html +=
      '<div class="actions"><button type="button" data-action="prev-puzzle">Previous</button>' +
      '<button type="button" data-action="reset-puzzle">Restart</button>' +
      '<button type="button" data-action="next-puzzle">Next</button></div>';
  }
  return html;
}

function render() {
  const puzzleTitle = state.mode === "puzzle" ? "Puzzle " + (state.puzzleIndex + 1) + " of " + state.puzzles.length : "Two players";
  const hasPuzzles = state.puzzles.length > 0;
  app.innerHTML =
    '<header><h1>Chess trainer</h1><nav aria-label="Mode">' +
    '<button type="button" data-action="mode-game" aria-pressed="' + (state.mode === "game") + '">Two players</button>' +
    '<button type="button" data-action="mode-puzzle" aria-pressed="' + (state.mode === "puzzle") + '"' + (hasPuzzles ? "" : " disabled") + ">Puzzles</button>" +
    "</nav></header>" +
    '<main><div class="board-wrap"><div class="board" data-testid="board">' + boardHtml() + "</div>" + promotionHtml() + "</div>" +
    '<section class="side"><h2>' + puzzleTitle + "</h2>" + sideHtml() + "</section></main>";
}

// ---------- input ----------

let drag: { from: number; x: number; y: number; ghost: HTMLElement | null; id: number } | null = null;

const squareAt = (el: Element | null): number => {
  const s = el?.closest<HTMLElement>("[data-square]");
  return s ? sq(s.dataset.square!) : -1;
};

app.addEventListener("pointerdown", (e) => {
  const board = (e.target as Element).closest(".board");
  if (!board || e.button > 0 || !canMove()) return;
  const i = squareAt(e.target as Element);
  if (i < 0) return;
  const p = cur();
  if (state.selected >= 0 && targetsFrom(state.selected).some((m) => m.to === i)) {
    tryMove(state.selected, i);
    return;
  }
  const piece = p.board[i];
  if (piece && piece[0] === p.turn) {
    e.preventDefault();
    state.selected = i;
    state.wrong = null;
    if (state.mode === "puzzle" && !state.solved) state.notice = "";
    render();
    drag = { from: i, x: e.clientX, y: e.clientY, ghost: null, id: e.pointerId };
  } else if (state.selected >= 0) {
    state.selected = -1;
    render();
  }
});

window.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    const src = app.querySelector<HTMLElement>('[data-square="' + name(drag.from) + '"] .piece');
    if (!src) return;
    const size = src.getBoundingClientRect().width;
    const ghost = src.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("data-piece");
    ghost.classList.add("ghost");
    ghost.style.width = ghost.style.height = size + "px";
    document.body.appendChild(ghost);
    src.classList.add("lifted");
    drag.ghost = ghost;
  }
  const size = drag.ghost.getBoundingClientRect().width;
  drag.ghost.style.transform = "translate(" + (e.clientX - size / 2) + "px," + (e.clientY - size / 2) + "px)";
});

function endDrag(e: PointerEvent, cancelled: boolean) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.ghost) return;
  d.ghost.remove();
  const target = cancelled ? -1 : squareAt(document.elementFromPoint(e.clientX, e.clientY));
  if (target >= 0 && target !== d.from) tryMove(d.from, target);
  else render();
}
window.addEventListener("pointerup", (e) => endDrag(e, false));
window.addEventListener("pointercancel", (e) => endDrag(e, true));

app.addEventListener("click", (e) => {
  const el = e.target as Element;
  const promo = el.closest<HTMLElement>(".promo button");
  if (promo && state.pending) {
    const m = state.pending.find((x) => x.promo === promo.dataset.piece);
    if (m) playMove(m);
    return;
  }
  if (el.classList.contains("promo-backdrop")) {
    state.pending = null;
    state.selected = -1;
    render();
    return;
  }
  const action = el.closest<HTMLElement>("[data-action]")?.dataset.action;
  switch (action) {
    case "new": startGame(START_FEN); break;
    case "undo":
      if (state.moves.length) {
        state.positions.pop();
        state.moves.pop();
        state.keys.pop();
        state.selected = -1;
        render();
      }
      break;
    case "flip": state.flipped = !state.flipped; render(); break;
    case "mode-game": if (state.mode !== "game") startGame(START_FEN); break;
    case "mode-puzzle": if (state.mode !== "puzzle") startPuzzle(0); break;
    case "next-puzzle": startPuzzle(state.puzzleIndex + 1); break;
    case "prev-puzzle": startPuzzle(state.puzzleIndex - 1); break;
    case "reset-puzzle": startPuzzle(state.puzzleIndex); break;
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (state.pending || state.selected >= 0)) {
    state.pending = null;
    state.selected = -1;
    render();
  }
});

// ---------- boot ----------

async function boot() {
  try {
    const res = await fetch(import.meta.env.BASE_URL + "puzzles.json");
    state.puzzles = await res.json();
  } catch {
    state.puzzles = [];
  }
  const params = new URLSearchParams(location.search);
  const puzzleParam = params.get("puzzle");
  const fen = params.get("fen");
  if (puzzleParam !== null && state.puzzles.length) {
    const n = Number.parseInt(puzzleParam, 10);
    startPuzzle(Number.isFinite(n) && n >= 1 && n <= state.puzzles.length ? n - 1 : 0);
  } else if (fen) {
    try {
      startGame(fen);
      // keep ?fen in the address so a reload gives the same position
      history.replaceState(null, "", "?fen=" + encodeURIComponent(toFen(state.positions[0])).replace(/%20/g, "+"));
    } catch {
      startGame(START_FEN);
      state.notice = "That FEN was not valid — started a new game.";
      render();
    }
  } else {
    startGame(START_FEN);
  }
}

boot();
