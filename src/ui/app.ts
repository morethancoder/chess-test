import { Game, START_FEN } from '../engine/index.ts';
import type { Colour, GameStatus, Move, Square } from '../engine/index.ts';
import { BoardView } from './board-view.ts';
import type { MoveInput } from './board-view.ts';
import { pieceSvg } from './pieces.ts';

interface Puzzle { id: number; type: string; fen: string; solution: string[] }

type Mode = 'play' | 'puzzle';

const colourName = (c: Colour) => (c === 'w' ? 'White' : 'Black');

function resultText(s: GameStatus): { title: string; detail: string } | null {
  switch (s.state) {
    case 'checkmate': return { title: 'Checkmate', detail: `${colourName(s.winner)} wins` };
    case 'stalemate': return { title: 'Stalemate', detail: 'Draw' };
    case 'draw':
      return {
        title: 'Draw',
        detail: s.reason === 'threefold' ? 'Threefold repetition' : 'Fifty-move rule',
      };
    default: return null;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export class App {
  private root: HTMLElement;
  private board: BoardView;
  private panel: HTMLElement;
  private tabs: HTMLElement;
  private banner: HTMLElement;

  private mode: Mode = 'play';
  private notice = '';

  // play mode
  private game = new Game();
  private startFen = START_FEN;
  private orientation: Colour = 'w';
  private gameOverDismissed = false;

  // puzzle mode
  private puzzles: Puzzle[] = [];
  private puzzleIndex = 0;
  private puzzleGame = new Game();
  private puzzleStep = 0;
  private puzzleSolved = false;
  private puzzleBusy = false;
  private puzzleWrong: { from: Square; to: Square } | null = null;
  private puzzleMessage = '';
  private solvedIds = new Set<number>();
  private replyTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.board = new BoardView({ onMove: (m) => this.onUserMove(m) });
    this.panel = el('aside', 'panel');
    this.tabs = el('nav', 'tabs');
    this.tabs.setAttribute('aria-label', 'Mode');
    this.banner = el('div', 'banner');
    this.banner.setAttribute('role', 'status');

    const header = el('header', 'top');
    const brand = el('div', 'brand');
    brand.innerHTML = `<span class="brand-mark">${pieceSvg('w', 'n')}</span><span>Chess trainer</span>`;
    header.append(brand, this.tabs);

    const main = el('main', 'layout');
    const boardCol = el('section', 'board-col');
    boardCol.append(this.board.el);
    main.append(boardCol, this.panel);
    root.replaceChildren(header, this.banner, main);

    try {
      const saved = JSON.parse(localStorage.getItem('solved-puzzles') || '[]');
      if (Array.isArray(saved)) this.solvedIds = new Set(saved.filter((n) => typeof n === 'number'));
    } catch { /* ignore */ }

    window.addEventListener('popstate', () => void this.loadFromUrl());
  }

  async start(): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
      this.puzzles = await res.json();
    } catch {
      this.puzzles = [];
    }
    await this.loadFromUrl();
  }

  private async loadFromUrl(): Promise<void> {
    const params = new URLSearchParams(location.search);
    this.notice = '';
    const puzzleParam = params.get('puzzle');
    const fenParam = params.get('fen');
    if (puzzleParam !== null && this.puzzles.length) {
      let n = Number.parseInt(puzzleParam, 10);
      if (!Number.isFinite(n) || n < 1 || n > this.puzzles.length) {
        this.notice = `There is no puzzle ${puzzleParam}; showing puzzle 1.`;
        n = 1;
      }
      this.mode = 'puzzle';
      this.openPuzzle(n - 1);
      return;
    }
    this.mode = 'play';
    let fen = START_FEN;
    if (fenParam) {
      try {
        new Game(fenParam);
        fen = fenParam;
      } catch {
        this.notice = 'That FEN could not be read, so the game starts from the standard position.';
      }
    }
    this.newGame(fen);
  }

  private navigate(search: string): void {
    const url = location.pathname + search;
    if (url !== location.pathname + location.search) history.pushState(null, '', url);
  }

  // ---------- play mode ----------

  private newGame(fen = START_FEN): void {
    this.startFen = fen;
    this.game = new Game(fen);
    this.orientation = 'w';
    this.gameOverDismissed = false;
    this.render();
  }

  private onUserMove(m: MoveInput): void {
    if (this.mode === 'puzzle') return this.onPuzzleMove(m);
    if (this.game.isGameOver()) return;
    if (!this.game.move(m)) return;
    this.render();
  }

  // ---------- puzzle mode ----------

  private openPuzzle(i: number): void {
    window.clearTimeout(this.replyTimer);
    this.puzzleIndex = i;
    const p = this.puzzles[i];
    this.puzzleGame = new Game(p.fen);
    this.puzzleStep = 0;
    this.puzzleSolved = false;
    this.puzzleBusy = false;
    this.puzzleWrong = null;
    this.puzzleMessage = '';
    this.render();
  }

  private goPuzzle(i: number): void {
    this.navigate(`?puzzle=${i + 1}`);
    this.notice = '';
    this.mode = 'puzzle';
    this.openPuzzle(i);
  }

  private onPuzzleMove(m: MoveInput): void {
    if (this.puzzleSolved || this.puzzleBusy) return;
    const p = this.puzzles[this.puzzleIndex];
    const g = this.puzzleGame;
    const played = g.move(m);
    if (!played) return;
    const expected = p.solution[this.puzzleStep];
    const last = this.puzzleStep === p.solution.length - 1;
    const ok = played.uci === expected || (last && g.status().state === 'checkmate');
    if (!ok) {
      g.undo();
      this.puzzleWrong = { from: m.from, to: m.to };
      this.puzzleMessage = `${played.san} isn't the answer. Try again.`;
      this.render();
      return;
    }
    this.puzzleWrong = null;
    this.puzzleStep++;
    if (this.puzzleStep >= p.solution.length) {
      this.puzzleSolved = true;
      this.solvedIds.add(p.id);
      try { localStorage.setItem('solved-puzzles', JSON.stringify([...this.solvedIds])); } catch { /* ignore */ }
      this.render();
      return;
    }
    this.puzzleMessage = `${played.san} — good. Waiting for the reply…`;
    this.puzzleBusy = true;
    this.render();
    this.replyTimer = window.setTimeout(() => {
      const reply = g.move(p.solution[this.puzzleStep]);
      this.puzzleStep++;
      this.puzzleBusy = false;
      this.puzzleMessage = reply ? `${colourName(g.turn() === 'w' ? 'b' : 'w')} replied ${reply.san}. Now find the mate.` : '';
      this.render();
    }, 450);
  }

  // ---------- rendering ----------

  private render(): void {
    this.renderTabs();
    this.banner.textContent = this.notice;
    this.banner.hidden = !this.notice;
    if (this.mode === 'play') this.renderPlay();
    else this.renderPuzzle();
  }

  private renderTabs(): void {
    const mk = (mode: Mode, label: string, go: () => void) => {
      const b = button(label, go, 'tab');
      b.setAttribute('aria-pressed', String(this.mode === mode));
      return b;
    };
    this.tabs.replaceChildren(
      mk('play', 'Play', () => {
        if (this.mode === 'play') return;
        window.clearTimeout(this.replyTimer);
        this.navigate('');
        this.notice = '';
        this.mode = 'play';
        this.newGame();
      }),
      mk('puzzle', 'Puzzles', () => {
        if (this.mode === 'puzzle') return;
        this.goPuzzle(this.puzzleIndex);
      }),
    );
  }

  private lastMoveOf(g: Game): { from: Square; to: Square } | null {
    const h = g.history();
    const m: Move | undefined = h[h.length - 1];
    return m ? { from: m.from, to: m.to } : null;
  }

  private renderPlay(): void {
    const g = this.game;
    const status = g.status();
    const over = resultText(status);
    this.board.set({ game: g, orientation: this.orientation, interactive: !over, lastMove: this.lastMoveOf(g), wrong: null });

    if (over && !this.gameOverDismissed) {
      const modal = el('div', 'game-over');
      modal.dataset.testid = 'game-over';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-label', 'Game over');
      modal.append(el('h2', '', over.title), el('p', '', over.detail));
      const row = el('div', 'row');
      row.append(
        button('New game', () => this.restart(), 'btn primary'),
        button('View board', () => { this.gameOverDismissed = true; this.render(); }, 'btn'),
      );
      modal.append(row);
      this.board.showModal(modal);
    }

    const card = el('div', 'card status-card');
    const turn = g.turn();
    const line = el('div', 'status-line');
    const dot = el('span', `turn-dot ${over ? 'over' : turn}`);
    let text: string;
    if (over) text = `${over.title} — ${over.detail}`;
    else text = `${colourName(turn)} to move${status.state === 'playing' && status.check ? ' · Check!' : ''}`;
    line.append(dot, el('span', '', text));
    card.append(el('h2', 'card-title', 'Two-player game'), line);
    const controls = el('div', 'row');
    const undo = button('Undo', () => {
      if (g.undo()) { this.gameOverDismissed = false; this.render(); }
    });
    undo.disabled = g.history().length === 0;
    controls.append(
      button('New game', () => this.restart(), 'btn primary'),
      undo,
      button('Flip board', () => { this.orientation = this.orientation === 'w' ? 'b' : 'w'; this.render(); }),
    );
    card.append(controls);

    const movesCard = el('div', 'card');
    movesCard.append(el('h2', 'card-title', 'Moves'));
    const list = el('ol', 'moves');
    const hist = g.history();
    const startBlack = new Game(this.startFen).turn() === 'b';
    const plies: (string | null)[] = startBlack ? [null, ...hist.map((m) => m.san)] : hist.map((m) => m.san);
    for (let i = 0; i < plies.length; i += 2) {
      const li = el('li');
      li.append(el('span', 'ply', plies[i] ?? '…'), el('span', 'ply', plies[i + 1] ?? ''));
      list.append(li);
    }
    if (!plies.length) list.append(el('li', 'empty', 'No moves yet. Tap or drag a piece.'));
    movesCard.append(list);
    this.panel.replaceChildren(card, movesCard);
    list.scrollTop = list.scrollHeight;
  }

  private restart(): void {
    if (this.startFen !== START_FEN) this.navigate('');
    this.notice = '';
    this.newGame(START_FEN);
  }

  private renderPuzzle(): void {
    const p = this.puzzles[this.puzzleIndex];
    const g = this.puzzleGame;
    const side = new Game(p.fen).turn();
    this.board.set({
      game: g,
      orientation: side,
      interactive: !this.puzzleSolved && !this.puzzleBusy,
      lastMove: this.lastMoveOf(g),
      wrong: this.puzzleWrong,
    });

    const card = el('div', 'card');
    const head = el('div', 'puzzle-head');
    head.append(
      el('h2', 'card-title', `Puzzle ${p.id} of ${this.puzzles.length}`),
      el('span', 'tag', p.type === 'mate-in-2' ? 'Mate in 2' : 'Mate in 1'),
    );
    card.append(head);
    card.append(el('p', 'muted', `${colourName(side)} to play and mate${p.type === 'mate-in-2' ? ' in two moves' : ' in one move'}.`));

    const feedback = el('div', 'feedback');
    feedback.setAttribute('aria-live', 'polite');
    if (this.puzzleSolved) {
      const solved = el('div', 'solved');
      solved.dataset.testid = 'puzzle-solved';
      solved.append(el('strong', '', 'Solved!'), el('span', '', ` Checkmate with ${g.history().at(-1)?.san ?? ''}.`));
      feedback.append(solved);
    } else if (this.puzzleMessage) {
      feedback.append(el('div', this.puzzleWrong ? 'msg wrong' : 'msg', this.puzzleMessage));
    }
    card.append(feedback);

    const row = el('div', 'row');
    const prev = button('Previous', () => this.goPuzzle(this.puzzleIndex - 1));
    prev.disabled = this.puzzleIndex === 0;
    const next = button('Next puzzle', () => this.goPuzzle(this.puzzleIndex + 1), this.puzzleSolved ? 'btn primary' : 'btn');
    next.disabled = this.puzzleIndex >= this.puzzles.length - 1;
    next.dataset.testid = 'next-puzzle';
    row.append(prev, button('Retry', () => this.openPuzzle(this.puzzleIndex)), next);
    card.append(row);

    const listCard = el('div', 'card');
    listCard.append(el('h2', 'card-title', 'All puzzles'));
    const grid = el('div', 'puzzle-grid');
    this.puzzles.forEach((q, i) => {
      const b = button(String(q.id), () => this.goPuzzle(i), 'pz');
      if (i === this.puzzleIndex) b.setAttribute('aria-current', 'true');
      if (this.solvedIds.has(q.id)) b.classList.add('done');
      b.setAttribute('aria-label', `Puzzle ${q.id}${this.solvedIds.has(q.id) ? ', solved' : ''}`);
      grid.append(b);
    });
    listCard.append(grid);
    this.panel.replaceChildren(card, listCard);
  }
}
