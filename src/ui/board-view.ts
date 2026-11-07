// Board rendering plus tap-to-move and pointer drag (mouse + touch).
import type { Color, Game, Move, Square } from "../engine/index.ts";
import { pieceSvg } from "./pieces.ts";

const FILES = "abcdefgh";

export interface BoardOptions {
  /** Which side may currently be moved by the user (null = none). */
  canMove: () => Color | null;
  /** Called when the user asks to move from → to. */
  onMove: (from: Square, to: Square) => void;
}

export class BoardView {
  el: HTMLElement;
  game: Game;
  orientation: Color = "w";
  selected: Square | null = null;
  flash: { squares: Square[]; cls: string } | null = null;
  private opts: BoardOptions;
  private drag: {
    from: Square;
    id: number;
    startX: number;
    startY: number;
    ghost: HTMLElement | null;
    wasSelected: boolean;
  } | null = null;

  constructor(el: HTMLElement, game: Game, opts: BoardOptions) {
    this.el = el;
    this.game = game;
    this.opts = opts;
    el.classList.add("board");
    el.addEventListener("pointerdown", (e) => this.onDown(e));
    el.addEventListener("pointermove", (e) => this.onMoveEvt(e));
    el.addEventListener("pointerup", (e) => this.onUp(e));
    el.addEventListener("pointercancel", () => this.cancelDrag());
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private targets(): Move[] {
    if (!this.selected) return [];
    return this.game.legalMoves(this.selected);
  }

  render(): void {
    const g = this.game;
    const last = g.lastMove();
    const targets = this.targets();
    const checkSq = g.inCheck() ? g.kingSquare(g.turn()) : null;
    const html: string[] = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const file = this.orientation === "w" ? f : 7 - f;
        const rank = this.orientation === "w" ? 7 - r : r;
        const sq = FILES[file] + (rank + 1);
        const light = (file + rank) % 2 === 1;
        const cls = ["sq", light ? "light" : "dark"];
        if (last && (last.from === sq || last.to === sq)) cls.push("last");
        if (this.selected === sq) cls.push("selected");
        if (checkSq === sq) cls.push("check");
        if (this.flash && this.flash.squares.includes(sq)) cls.push(this.flash.cls);
        const t = targets.find((m) => m.to === sq);
        if (t) cls.push(g.get(sq) || t.flags.enPassant ? "target-capture" : "target");
        const p = g.get(sq);
        let inner = "";
        if (f === 0) inner += `<span class="coord rank">${rank + 1}</span>`;
        if (r === 7) inner += `<span class="coord file">${FILES[file]}</span>`;
        if (p) {
          inner += `<div class="piece" data-piece="${p.color}${p.type.toUpperCase()}">${pieceSvg(p.color, p.type)}</div>`;
        }
        html.push(`<div class="${cls.join(" ")}" data-square="${sq}">${inner}</div>`);
      }
    }
    this.el.innerHTML = html.join("");
  }

  private squareAt(x: number, y: number): Square | null {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-square]");
    return hit && this.el.contains(hit) ? (hit.dataset.square as Square) : null;
  }

  private ownPiece(sq: Square): boolean {
    const side = this.opts.canMove();
    const p = this.game.get(sq);
    return !!p && side !== null && p.color === side;
  }

  private onDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const sq = (e.target as HTMLElement).closest<HTMLElement>("[data-square]")?.dataset.square;
    if (!sq) return;
    if (this.selected && this.targets().some((m) => m.to === sq)) {
      const from = this.selected;
      this.selected = null;
      this.opts.onMove(from, sq);
      return;
    }
    if (this.ownPiece(sq)) {
      e.preventDefault();
      const wasSelected = this.selected === sq;
      this.selected = sq;
      this.render();
      this.drag = { from: sq, id: e.pointerId, startX: e.clientX, startY: e.clientY, ghost: null, wasSelected };
      try { this.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    } else if (this.selected) {
      this.selected = null;
      this.render();
    }
  }

  private onMoveEvt(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
      const src = this.el.querySelector<HTMLElement>(`[data-square="${d.from}"] .piece`);
      if (!src) return;
      const rect = src.getBoundingClientRect();
      const ghost = document.createElement("div");
      ghost.className = "drag-ghost";
      ghost.innerHTML = src.innerHTML;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      document.body.appendChild(ghost);
      src.classList.add("dragging");
      d.ghost = ghost;
    }
    const w = d.ghost.offsetWidth;
    d.ghost.style.transform = `translate(${e.clientX - w / 2}px, ${e.clientY - w / 2}px) scale(1.12)`;
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    const dragged = !!d.ghost;
    d.ghost?.remove();
    const to = this.squareAt(e.clientX, e.clientY);
    if (dragged) {
      if (to && to !== d.from && this.game.legalMoves(d.from).some((m) => m.to === to)) {
        this.selected = null;
        this.opts.onMove(d.from, to);
        return;
      }
      this.render();
      return;
    }
    // Plain tap on an already-selected piece toggles it off.
    if (d.wasSelected && to === d.from) {
      this.selected = null;
      this.render();
    }
  }

  private cancelDrag(): void {
    this.drag?.ghost?.remove();
    this.drag = null;
    this.render();
  }
}
