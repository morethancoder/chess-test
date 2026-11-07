import { Game, START_FEN, isValidFen } from "../engine/index.ts";
import type { Color, GameStatus, Move, Square } from "../engine/index.ts";
import { BoardView } from "./board-view.ts";
import { pieceSvg } from "./pieces.ts";

interface Puzzle {
  id: number;
  type: "mate-in-1" | "mate-in-2";
  fen: string;
  solution: string[];
}

type Promo = "q" | "r" | "b" | "n";
const NAME: Record<Color, string> = { w: "White", b: "Black" };

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) =>
  root.querySelector(sel) as T;

export class App {
  private root: HTMLElement;
  private mode: "play" | "puzzle" = "play";
  private game = new Game();
  private board!: BoardView;
  private puzzles: Puzzle[] = [];
  private pIndex = 0;
  private pStep = 0;
  private pSolved = false;
  private pFeedback: "" | "wrong" | "good" = "";
  private busy = false; // waiting for an automatic reply
  private notice = "";
  private gameOverDismissed = false;
  private startFen = START_FEN;
  private timers: number[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    this.root.innerHTML = `
      <header class="top">
        <h1 class="brand"><span class="brand-mark">${pieceSvg("w", "n")}</span>Gambit</h1>
        <nav class="tabs" role="tablist">
          <button role="tab" data-tab="play">Play</button>
          <button role="tab" data-tab="puzzle">Puzzles</button>
        </nav>
      </header>
      <main class="layout">
        <section class="board-col">
          <div class="board-frame">
            <div id="board" aria-label="Chess board"></div>
            <div id="overlay"></div>
          </div>
        </section>
        <aside class="panel" id="panel"></aside>
      </main>`;
    this.board = new BoardView($(this.root, "#board"), this.game, {
      canMove: () => this.userSide(),
      onMove: (from, to) => this.userMove(from, to),
    });
    this.root.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.tab === "play") this.newGame(START_FEN, true);
        else this.openPuzzle(this.mode === "puzzle" ? this.pIndex : 0, true);
      }),
    );
    this.root.addEventListener("click", (e) => this.onClick(e));
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
      this.puzzles = (await res.json()) as Puzzle[];
    } catch {
      this.puzzles = [];
    }
    const params = new URLSearchParams(location.search);
    const pz = params.get("puzzle");
    const fen = params.get("fen");
    if (pz !== null) {
      const n = Number.parseInt(pz, 10);
      if (n >= 1 && n <= this.puzzles.length) this.openPuzzle(n - 1, false);
      else {
        this.notice = `There is no puzzle ${pz}. Showing puzzle 1.`;
        this.openPuzzle(0, false);
      }
    } else if (fen !== null) {
      if (isValidFen(fen)) this.newGame(fen, false);
      else {
        this.notice = "That FEN could not be read. Starting a normal game.";
        this.newGame(START_FEN, false);
      }
    } else this.newGame(START_FEN, false);
  }

  private clearTimers(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private setUrl(q: string): void {
    history.replaceState(null, "", `${location.pathname}${q}`);
  }

  private attachGame(g: Game): void {
    this.game = g;
    this.board.game = g;
    this.board.selected = null;
    this.board.flash = null;
  }

  newGame(fen: string, updateUrl: boolean): void {
    this.clearTimers();
    this.mode = "play";
    this.startFen = fen;
    this.attachGame(new Game(fen));
    this.board.orientation = "w";
    this.gameOverDismissed = false;
    this.busy = false;
    if (updateUrl) this.setUrl(fen === START_FEN ? "" : `?fen=${encodeURIComponent(fen)}`);
    this.renderAll();
  }

  openPuzzle(i: number, updateUrl: boolean): void {
    this.clearTimers();
    const p = this.puzzles[i];
    if (!p) {
      this.notice = "Puzzles could not be loaded.";
      this.newGame(START_FEN, false);
      return;
    }
    this.mode = "puzzle";
    this.pIndex = i;
    this.pStep = 0;
    this.pSolved = false;
    this.pFeedback = "";
    this.busy = false;
    this.attachGame(new Game(p.fen));
    this.board.orientation = this.game.turn();
    if (updateUrl) this.setUrl(`?puzzle=${i + 1}`);
    this.renderAll();
  }

  private userSide(): Color | null {
    if (this.busy) return null;
    if (this.game.isGameOver()) return null;
    if (this.mode === "puzzle") {
      const p = this.puzzles[this.pIndex];
      if (this.pSolved || !p) return null;
      return new Game(p.fen).turn();
    }
    return this.game.turn();
  }

  private userMove(from: Square, to: Square): void {
    const options = this.game.legalMoves(from).filter((m) => m.to === to);
    if (!options.length) return this.renderAll();
    if (options.some((m) => m.promotion)) {
      this.showPromotion(from, to);
      return;
    }
    this.commit(from, to);
  }

  private commit(from: Square, to: Square, promotion?: Promo): void {
    const mv = this.game.move({ from, to, promotion });
    if (!mv) return this.renderAll();
    this.notice = "";
    if (this.mode === "puzzle") this.checkPuzzleMove(mv);
    this.renderAll();
  }

  private uci(m: Move): string {
    return m.from + m.to + (m.promotion ?? "");
  }

  private checkPuzzleMove(mv: Move): void {
    const p = this.puzzles[this.pIndex];
    const expected = p.solution[this.pStep];
    const st = this.game.status();
    // Any mating move is accepted; otherwise it must match the solution.
    const mates = st.state === "checkmate";
    if (this.uci(mv) === expected || mates) {
      this.pStep += 1;
      if (mates || this.pStep >= p.solution.length) {
        this.pSolved = true;
        this.pFeedback = "good";
        return;
      }
      this.pFeedback = "good";
      this.busy = true;
      this.later(550, () => {
        this.game.moveUci(p.solution[this.pStep]);
        this.pStep += 1;
        this.busy = false;
        this.pFeedback = "";
        this.renderAll();
      });
    } else {
      this.pFeedback = "wrong";
      this.busy = true;
      this.board.flash = { squares: [mv.from, mv.to], cls: "wrong" };
      this.later(700, () => {
        this.game.undo();
        this.board.flash = null;
        this.busy = false;
        this.renderAll();
      });
    }
  }

  private showPromotion(from: Square, to: Square): void {
    const color = this.game.turn();
    const ov = $(this.root, "#overlay");
    ov.innerHTML = `
      <div class="scrim" data-action="promo-cancel"></div>
      <div class="promo" data-testid="promotion" role="dialog" aria-label="Choose promotion piece">
        <p>Promote to</p>
        <div class="promo-row">
          ${(["q", "r", "b", "n"] as Promo[])
            .map(
              (t) =>
                `<button class="promo-btn" data-piece="${t}" data-from="${from}" data-to="${to}" aria-label="${
                  { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[t]
                }">${pieceSvg(color, t)}</button>`,
            )
            .join("")}
        </div>
      </div>`;
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-action], .promo-btn");
    if (!t) return;
    if (t.classList.contains("promo-btn")) {
      $(this.root, "#overlay").innerHTML = "";
      this.commit(t.dataset.from!, t.dataset.to!, t.dataset.piece as Promo);
      return;
    }
    switch (t.dataset.action) {
      case "promo-cancel":
        $(this.root, "#overlay").innerHTML = "";
        this.renderAll();
        break;
      case "new":
        this.newGame(this.startFen, false);
        break;
      case "new-standard":
        this.newGame(START_FEN, true);
        break;
      case "undo":
        if (this.mode === "play" && this.game.undo()) {
          this.gameOverDismissed = false;
          this.board.selected = null;
          this.renderAll();
        }
        break;
      case "flip":
        this.board.orientation = this.board.orientation === "w" ? "b" : "w";
        this.renderAll();
        break;
      case "close-over":
        this.gameOverDismissed = true;
        this.renderAll();
        break;
      case "retry":
        this.openPuzzle(this.pIndex, false);
        break;
      case "next":
        this.openPuzzle((this.pIndex + 1) % this.puzzles.length, true);
        break;
      case "prev":
        this.openPuzzle((this.pIndex - 1 + this.puzzles.length) % this.puzzles.length, true);
        break;
      case "goto":
        this.openPuzzle(Number(t.dataset.index), true);
        break;
    }
  }

  private resultText(st: GameStatus): { title: string; detail: string } {
    switch (st.state) {
      case "checkmate":
        return { title: `${NAME[st.winner]} wins`, detail: "by checkmate" };
      case "stalemate":
        return { title: "Draw", detail: "by stalemate" };
      case "draw":
        return {
          title: "Draw",
          detail: st.reason === "threefold" ? "by threefold repetition" : "by the 50-move rule",
        };
      default:
        return { title: "", detail: "" };
    }
  }

  private statusLine(): string {
    const st = this.game.status();
    if (st.state !== "playing") {
      const r = this.resultText(st);
      return `<span class="dot over"></span>${r.title} ${r.detail}`;
    }
    const side = this.game.turn();
    return `<span class="dot ${side}"></span>${NAME[side]} to move${
      st.check ? ' <strong class="check-tag">Check</strong>' : ""
    }`;
  }

  private moveListHtml(): string {
    const h = this.game.history();
    if (!h.length) return `<p class="muted">No moves yet.</p>`;
    const startBlack = new Game(this.mode === "puzzle" ? this.puzzles[this.pIndex].fen : this.startFen).turn() === "b";
    const rows: string[] = [];
    let n = 1;
    let i = 0;
    const label = (m: Move) => m.san ?? `${m.from}-${m.to}`;
    if (startBlack) {
      rows.push(`<li><span class="num">${n}.</span><span>…</span><span>${label(h[0])}</span></li>`);
      i = 1;
      n++;
    }
    for (; i < h.length; i += 2, n++) {
      rows.push(
        `<li><span class="num">${n}.</span><span>${label(h[i])}</span><span>${h[i + 1] ? label(h[i + 1]) : ""}</span></li>`,
      );
    }
    return `<ol class="moves">${rows.join("")}</ol>`;
  }

  private panelPlay(): string {
    return `
      <div class="card">
        <h2>Two players</h2>
        <p class="status" aria-live="polite">${this.statusLine()}</p>
        ${this.notice ? `<p class="notice">${this.notice}</p>` : ""}
        <div class="btns">
          <button class="btn primary" data-action="new">New game</button>
          <button class="btn" data-action="undo" ${this.game.history().length ? "" : "disabled"}>Undo</button>
          <button class="btn" data-action="flip">Flip</button>
        </div>
      </div>
      <div class="card moves-card">
        <h3>Moves</h3>
        ${this.moveListHtml()}
      </div>`;
  }

  private panelPuzzle(): string {
    const p = this.puzzles[this.pIndex];
    const side = NAME[new Game(p.fen).turn()];
    let fb = `<p class="hint">Find the best move for ${side}.</p>`;
    if (this.pSolved) {
      fb = `<div class="solved" data-testid="puzzle-solved">
          <strong>Solved!</strong> <span>Checkmate — well played.</span>
          <button class="btn primary" data-action="next">Next puzzle →</button>
        </div>`;
    } else if (this.pFeedback === "wrong") {
      fb = `<p class="wrong-msg" role="alert">Not quite — that isn't the move. Try again.</p>`;
    } else if (this.pFeedback === "good" || this.pStep > 0) {
      fb = `<p class="good-msg">Good move! ${this.busy ? "Waiting for the reply…" : "Now finish it."}</p>`;
    }
    const dots = this.puzzles
      .map(
        (q, i) =>
          `<button class="pdot ${i === this.pIndex ? "on" : ""}" data-action="goto" data-index="${i}" aria-label="Puzzle ${q.id}">${q.id}</button>`,
      )
      .join("");
    return `
      <div class="card">
        <div class="ptitle">
          <h2>Puzzle ${p.id} <span class="muted">/ ${this.puzzles.length}</span></h2>
          <span class="badge">${p.type === "mate-in-1" ? "Mate in 1" : "Mate in 2"}</span>
        </div>
        <p class="status">${side} to play and mate.</p>
        ${this.notice ? `<p class="notice">${this.notice}</p>` : ""}
        ${fb}
        <div class="btns">
          <button class="btn" data-action="prev">← Prev</button>
          <button class="btn" data-action="retry">Reset</button>
          <button class="btn" data-action="next">Next →</button>
        </div>
      </div>
      <div class="card">
        <h3>All puzzles</h3>
        <div class="pdots">${dots}</div>
      </div>`;
  }

  private renderAll(): void {
    this.root.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
      const on = b.dataset.tab === this.mode;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
    });
    this.board.render();
    $(this.root, "#panel").innerHTML = this.mode === "play" ? this.panelPlay() : this.panelPuzzle();
    const ov = $(this.root, "#overlay");
    const st = this.game.status();
    if (this.mode === "play" && st.state !== "playing" && !this.gameOverDismissed) {
      const r = this.resultText(st);
      ov.innerHTML = `
        <div class="scrim"></div>
        <div class="over" data-testid="game-over" role="dialog" aria-label="Game over">
          <p class="over-kicker">Game over</p>
          <h2>${r.title}</h2>
          <p>${r.detail}</p>
          <div class="btns">
            <button class="btn primary" data-action="new-standard">New game</button>
            <button class="btn" data-action="close-over">View board</button>
          </div>
        </div>`;
    } else if (!ov.querySelector(".promo")) {
      ov.innerHTML = "";
    }
  }
}
