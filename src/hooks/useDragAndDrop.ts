import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Location, PileKind } from '../engine/gameState';

/** Pointer travel (px) before a press turns into a drag; below this it is a click/tap. */
const DRAG_THRESHOLD = 7;

export interface DragInfo {
  from: Location;
  count: number;
  cards: number[];
  /** Top-left of the grabbed card at drag start (viewport coords). */
  originX: number;
  originY: number;
}

export interface DropRect {
  id: number;
  rect: DOMRect;
}

interface Pending {
  pointerId: number;
  startX: number;
  startY: number;
  from: Location;
  count: number;
  cards: number[];
  cardRect: DOMRect;
}

export function parseDropTarget(value: string | undefined): Location | null {
  if (!value) return null;
  const [kind, index] = value.split(':');
  if (kind !== 'tableau' && kind !== 'freecell' && kind !== 'foundation') return null;
  return { kind: kind as PileKind, index: Number(index) };
}

/** Pick the drop zone overlapping the dragged card the most (forgiving on touch screens). */
function findDropTarget(ghostRect: DOMRect, px: number, py: number): Location | null {
  const zones = document.querySelectorAll<HTMLElement>('[data-drop]');
  let best: Location | null = null;
  let bestArea = 0;
  zones.forEach((el) => {
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, ghostRect.right) - Math.max(r.left, ghostRect.left);
    const h = Math.min(r.bottom, ghostRect.bottom) - Math.max(r.top, ghostRect.top);
    const area = w > 0 && h > 0 ? w * h : 0;
    if (area > bestArea) {
      bestArea = area;
      best = parseDropTarget(el.dataset.drop);
    }
  });
  if (best) return best;
  const under = document.elementFromPoint(px, py)?.closest<HTMLElement>('[data-drop]');
  return parseDropTarget(under?.dataset.drop);
}

export interface DragCallbacks {
  onDragStart: (from: Location, count: number) => void;
  /** Called with the ghost card rects (for the snap animation) and the target (or null). */
  onDrop: (from: Location, count: number, to: Location | null, ghostRects: DropRect[]) => void;
}

export function useDragAndDrop({ onDragStart, onDrop }: DragCallbacks) {
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const pending = useRef<Pending | null>(null);
  const dragging = useRef<DragInfo | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ dx: 0, dy: 0 });
  const suppressClick = useRef(false);
  const callbacks = useRef({ onDragStart, onDrop });
  callbacks.current = { onDragStart, onDrop };

  const positionGhost = () => {
    const g = ghostRef.current;
    if (g) g.style.transform = `translate3d(${pos.current.dx}px, ${pos.current.dy}px, 0)`;
  };

  const finish = useCallback((e: PointerEvent | null) => {
    const p = pending.current;
    const d = dragging.current;
    pending.current = null;
    dragging.current = null;
    if (!d || !p) return;
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);

    const ghostRects: DropRect[] = [];
    ghostRef.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      ghostRects.push({ id: Number(el.dataset.cardId), rect: el.getBoundingClientRect() });
    });
    let target: Location | null = null;
    if (e) {
      const first = ghostRects[0]?.rect ?? new DOMRect(e.clientX, e.clientY, 1, 1);
      target = findDropTarget(first, e.clientX, e.clientY);
    }
    setDrag(null);
    callbacks.current.onDrop(d.from, d.count, target, ghostRects);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      if (!dragging.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        const info: DragInfo = {
          from: p.from,
          count: p.count,
          cards: p.cards,
          originX: p.cardRect.left,
          originY: p.cardRect.top,
        };
        dragging.current = info;
        setDrag(info);
        callbacks.current.onDragStart(p.from, p.count);
      }
      e.preventDefault();
      pos.current = { dx, dy };
      positionGhost();
    };
    const onUp = (e: PointerEvent) => {
      if (pending.current && e.pointerId === pending.current.pointerId) finish(e);
    };
    const onCancel = (e: PointerEvent) => {
      if (pending.current && e.pointerId === pending.current.pointerId) finish(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [finish]);

  /** Start tracking a press on a movable card. */
  const beginPress = useCallback(
    (e: ReactPointerEvent<HTMLElement>, from: Location, count: number, cards: number[]) => {
      if (e.button !== 0 || pending.current) return;
      pending.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        from,
        count,
        cards,
        cardRect: e.currentTarget.getBoundingClientRect(),
      };
      pos.current = { dx: 0, dy: 0 };
    },
    [],
  );

  /** Ref callback for the ghost container; positions it as soon as it mounts. */
  const setGhost = useCallback((el: HTMLDivElement | null) => {
    ghostRef.current = el;
    if (el) positionGhost();
  }, []);

  /** True if the click that follows a drag should be ignored. */
  const shouldSuppressClick = () => suppressClick.current;

  return { drag, beginPress, setGhost, shouldSuppressClick };
}
