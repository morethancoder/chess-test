import type { Colour, Game, Move, Square } from '../engine/index.ts';
import { pieceSvg, PIECE_NAMES } from './pieces.ts';

type Promo = 'q' | 'r' | 'b' | 'n';
export interface MoveInput { from: Square; to: Square; promotion?: Promo }

export interface BoardOptions {
  /** Called with a legal move picked by the user (promotion already chosen). */
  onMove: (m: MoveInput) => void;
}

interface DragState {
  from: Square;
  pointerId: number;
  startX: number;
  startY: number;
  wasSelected: boolean;
  dragging: boolean;
  ghost?: HTMLElement;
}

const FILES = 'abcdefgh';

export class BoardView {
  readonly el: HTMLElement;
  private grid: HTMLElement;
  private overlay: HTMLElement;
  private game: Game | null = null;
  private orientation: Colour = 'w';
  private interactive = true;
  private selected: Square | null = null;
  private lastMove: { from: Square; to: Square } | null = null;
  private wrong: { from: Square; to: Square } | null = null;
  private drag: DragState | null = null;
  private pendingPromo: { from: Square; to: Square } | null = null;
  private opts: BoardOptions;

  constructor(opts: BoardOptions) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'board-wrap';
    this.grid = document.createElement('div');
    this.grid.className = 'board';
    this.grid.setAttribute('role', 'grid');
    this.grid.setAttribute('aria-label', 'Chess board');
    this.overlay = document.createElement('div');
    this.overlay.className = 'board-overlay';
    this.el.append(this.grid, this.overlay);
    this.grid.addEventListener('pointerdown', (e) => this.onDown(e));
    this.grid.addEventListener('pointermove', (e) => this.onMoveEvt(e));
    this.grid.addEventListener('pointerup', (e) => this.onUp(e));
    this.grid.addEventListener('pointercancel', () => this.cancelDrag());
    this.grid.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  set(state: {
    game: Game;
    orientation?: Colour;
    interactive?: boolean;
    lastMove?: { from: Square; to: Square } | null;
    wrong?: { from: Square; to: Square } | null;
  }): void {
    this.game = state.game;
    if (state.orientation) this.orientation = state.orientation;
    if (state.interactive !== undefined) this.interactive = state.interactive;
    if (state.lastMove !== undefined) this.lastMove = state.lastMove;
    if (state.wrong !== undefined) this.wrong = state.wrong;
    if (!this.interactive) this.selected = null;
    this.closePromo();
    this.render();
  }

  private targets(): Move[] {
    if (!this.game || !this.selected) return [];
    return this.game.moves(this.selected);
  }

  render(): void {
    const game = this.game;
    if (!game) return;
    const targets = new Map<Square, Move>();
    for (const m of this.targets()) targets.set(m.to, m);
    const checkSq = game.inCheck() ? game.kingSquare(game.turn()) : null;
    const frag = document.createDocumentFragment();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const file = this.orientation === 'w' ? col : 7 - col;
        const rank = this.orientation === 'w' ? 7 - row : row; // 0-based rank index
        const sq = FILES[file] + (rank + 1);
        const cell = document.createElement('div');
        const light = (file + rank) % 2 === 1;
        cell.className = 'sq ' + (light ? 'light' : 'dark');
        cell.dataset.square = sq;
        cell.setAttribute('role', 'gridcell');
        if (this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq)) cell.classList.add('last');
        if (this.wrong && (this.wrong.from === sq || this.wrong.to === sq)) cell.classList.add('wrong');
        if (this.selected === sq) cell.classList.add('selected');
        if (checkSq === sq) cell.classList.add('check');
        const p = game.get(sq);
        const t = targets.get(sq);
        if (t) cell.classList.add(p || t.flags.enPassant ? 'target-capture' : 'target');
        if (col === 0) cell.insertAdjacentHTML('beforeend', `<span class="coord rank">${rank + 1}</span>`);
        if (row === 7) cell.insertAdjacentHTML('beforeend', `<span class="coord file">${FILES[file]}</span>`);
        let label = sq;
        if (p) {
          const piece = document.createElement('div');
          piece.className = 'piece';
          piece.dataset.piece = p.colour + p.type.toUpperCase();
          piece.innerHTML = pieceSvg(p.colour, p.type);
          if (this.drag?.dragging && this.drag.from === sq) piece.classList.add('dragging-src');
          cell.append(piece);
          label += `, ${p.colour === 'w' ? 'white' : 'black'} ${PIECE_NAMES[p.type]}`;
        }
        cell.setAttribute('aria-label', label);
        frag.append(cell);
      }
    }
    this.grid.replaceChildren(frag);
  }

  private squareAt(x: number, y: number): Square | null {
    const r = this.grid.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * 8);
    const row = Math.floor(((y - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = this.orientation === 'w' ? col : 7 - col;
    const rank = this.orientation === 'w' ? 7 - row : row;
    return FILES[file] + (rank + 1);
  }

  private ownPiece(sq: Square): boolean {
    const p = this.game?.get(sq);
    return !!p && p.colour === this.game!.turn();
  }

  private onDown(e: PointerEvent): void {
    if (!this.game || !this.interactive || this.pendingPromo) return;
    if (e.button !== 0) return;
    const sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    e.preventDefault();
    if (this.selected && sq !== this.selected && this.targets().some((m) => m.to === sq)) {
      this.attempt(this.selected, sq);
      return;
    }
    if (this.ownPiece(sq)) {
      const wasSelected = this.selected === sq;
      this.selected = sq;
      this.wrong = null;
      this.drag = { from: sq, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, wasSelected, dragging: false };
      try { this.grid.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.render();
      return;
    }
    if (this.selected) {
      this.selected = null;
      this.render();
    }
  }

  private onMoveEvt(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.dragging) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      d.dragging = true;
      const p = this.game!.get(d.from)!;
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      const size = this.grid.getBoundingClientRect().width / 8;
      ghost.style.width = ghost.style.height = `${size}px`;
      ghost.innerHTML = pieceSvg(p.colour, p.type);
      document.body.append(ghost);
      d.ghost = ghost;
      this.render();
    }
    if (d.ghost) {
      const s = d.ghost.offsetWidth;
      d.ghost.style.transform = `translate(${e.clientX - s / 2}px, ${e.clientY - s / 2}px)`;
    }
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || d.pointerId !== e.pointerId) return;
    this.drag = null;
    d.ghost?.remove();
    const sq = this.squareAt(e.clientX, e.clientY);
    if (d.dragging) {
      if (sq && sq !== d.from && this.targets().some((m) => m.to === sq)) {
        this.attempt(d.from, sq);
        return;
      }
      this.render();
      return;
    }
    if (d.wasSelected && sq === d.from) {
      this.selected = null;
      this.render();
    }
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    this.drag.ghost?.remove();
    this.drag = null;
    this.render();
  }

  private attempt(from: Square, to: Square): void {
    const moves = this.game!.moves(from).filter((m) => m.to === to);
    if (!moves.length) return;
    if (moves.some((m) => m.promotion)) {
      this.openPromo(from, to);
      return;
    }
    this.selected = null;
    this.opts.onMove({ from, to });
  }

  private openPromo(from: Square, to: Square): void {
    this.pendingPromo = { from, to };
    const colour = this.game!.turn();
    const picker = document.createElement('div');
    picker.className = 'promotion';
    picker.dataset.testid = 'promotion';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', 'Choose promotion piece');
    picker.innerHTML = `<p>Promote to</p><div class="promo-row">${(['q', 'r', 'b', 'n'] as const)
      .map(
        (t) =>
          `<button type="button" data-piece="${t}" aria-label="${PIECE_NAMES[t]}" title="${PIECE_NAMES[t]}">${pieceSvg(colour, t)}</button>`,
      )
      .join('')}</div><button type="button" class="promo-cancel">Cancel</button>`;
    picker.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      const promo = btn.dataset.piece as Promo | undefined;
      const pending = this.pendingPromo;
      this.closePromo();
      if (promo && pending) {
        this.selected = null;
        this.opts.onMove({ ...pending, promotion: promo });
      } else {
        this.render();
      }
    });
    this.overlay.replaceChildren(picker);
    this.overlay.classList.add('open');
    (picker.querySelector('button') as HTMLButtonElement).focus();
  }

  private closePromo(): void {
    this.pendingPromo = null;
    this.overlay.replaceChildren();
    this.overlay.classList.remove('open');
  }

  /** Shows a modal over the board (used for the game-over screen). */
  showModal(node: HTMLElement): void {
    this.overlay.replaceChildren(node);
    this.overlay.classList.add('open');
  }

  clearModal(): void {
    this.closePromo();
  }
}
