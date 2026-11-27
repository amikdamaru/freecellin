import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { nextFoundationCards } from '../engine/autoPlay';
import { validDestinations } from '../engine/moveValidator';
import type { Location } from '../engine/gameState';
import type { GameApi } from '../hooks/useGame';
import { fanOffset, useBoardLayout } from '../hooks/useBoardLayout';
import { useDragAndDrop, type DropRect } from '../hooks/useDragAndDrop';
import { Card } from './Card';
import { Foundation } from './Foundation';
import { FreeCell } from './FreeCell';
import { Tableau } from './Tableau';

const key = (l: Location) => `${l.kind}:${l.index}`;
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function GameBoard({ game }: { game: GameApi }) {
  const { session, selection, changeKind, rejection, autoCompleting } = game;
  const { board } = session;
  const enabled = session.status === 'playing' && !autoCompleting;

  const areaRef = useRef<HTMLDivElement>(null);
  const pilesRef = useRef<HTMLDivElement>(null);
  const layout = useBoardLayout(areaRef);

  // ---- Drag and drop -------------------------------------------------------
  const ghostOverrides = useRef(new Map<number, DOMRect>());
  const [dropNonce, setDropNonce] = useState(0);

  const { drag, beginPress, setGhost, shouldSuppressClick } = useDragAndDrop({
    onDragStart: (from, count) => game.setSelection({ from, count }),
    onDrop: (from, count, to, ghostRects: DropRect[]) => {
      ghostRects.forEach(({ id, rect }) => ghostOverrides.current.set(id, rect));
      game.onDrop(from, count, to);
      setDropNonce((n) => n + 1);
    },
  });

  const press = useCallback(
    (e: PointerEvent<HTMLElement>, from: Location, count: number) => {
      const cards =
        from.kind === 'tableau'
          ? board.tableau[from.index].slice(-count)
          : from.kind === 'foundation'
            ? board.foundations[from.index].slice(-1)
            : [board.freeCells[from.index] as number];
      beginPress(e, from, count, cards);
    },
    [beginPress, board],
  );

  const guard = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    if (!shouldSuppressClick()) fn(...args);
  };

  // ---- Highlights ------------------------------------------------------------
  const active = drag ? { from: drag.from, count: drag.count } : selection;
  const targets = useMemo(() => {
    if (!active || !enabled) return new Set<string>();
    return new Set(validDestinations(board, active.from, active.count).map(key));
  }, [active, board, enabled]);
  const lifted = useMemo(() => new Set(drag?.cards ?? []), [drag]);
  // The next card each foundation needs, highlighted wherever it sits in the tableau.
  const hinted = useMemo(
    () => new Set(session.status === 'playing' ? nextFoundationCards(board) : []),
    [board, session.status],
  );

  // ---- FLIP animation of moved cards ----------------------------------------
  const prevRects = useRef(new Map<number, DOMRect>());
  const prevBoard = useRef(board);

  useLayoutEffect(() => {
    const root = pilesRef.current;
    if (!root) return;
    const boardChanged = prevBoard.current !== board;
    prevBoard.current = board;
    const animate =
      !prefersReducedMotion() && (ghostOverrides.current.size > 0 || (boardChanged && (changeKind === 'move' || changeKind === 'undo')));
    const next = new Map<number, DOMRect>();
    root.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      const id = Number(el.dataset.cardId);
      const rect = el.getBoundingClientRect();
      next.set(id, rect);
      if (!animate) return;
      const from = ghostOverrides.current.get(id) ?? prevRects.current.get(id);
      if (!from) return;
      const dx = from.left - rect.left;
      const dy = from.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 500 }, { transform: 'translate(0, 0)', zIndex: 500 }], {
        duration: ghostOverrides.current.has(id) ? 140 : 200,
        easing: 'cubic-bezier(.2,.7,.3,1)',
      });
    });
    ghostOverrides.current.clear();
    prevRects.current = next;
  }, [board, dropNonce, changeKind, layout]);

  // ---- Invalid-move feedback (gentle shake) ---------------------------------
  useEffect(() => {
    if (!rejection || prefersReducedMotion()) return;
    rejection.cards.forEach((id) => {
      pilesRef.current?.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
        { duration: 260, easing: 'ease-out' },
      );
    });
  }, [rejection]);

  const style = {
    '--cw': `${layout.cardW}px`,
    '--ch': `${layout.cardH}px`,
    '--gap': `${layout.gap}px`,
  } as CSSProperties;

  const ghostOffset = drag?.from.kind === 'tableau' ? fanOffset(board.tableau[drag.from.index].length, layout) : 0;

  return (
    <div className="board-area" ref={areaRef} style={style}>
      <div
        className={`board${enabled ? '' : ' board--locked'}`}
        ref={pilesRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) game.clearSelection();
        }}
      >
        <div className="board__top" onClick={(e) => e.target === e.currentTarget && game.clearSelection()}>
          {board.freeCells.map((card, i) => {
            const loc: Location = { kind: 'freecell', index: i };
            const isSel = selection?.from.kind === 'freecell' && selection.from.index === i;
            return (
              <FreeCell
                key={`cell-${i}`}
                index={i}
                card={card}
                selected={isSel}
                lifted={card !== null && lifted.has(card)}
                target={targets.has(key(loc))}
                enabled={enabled}
                onActivate={guard(() => (card !== null ? game.onCard(loc, 0) : game.onPile(loc)))}
                onQuickMove={() => game.onQuickMove(loc, 0)}
                onPress={(e) => press(e, loc, 1)}
              />
            );
          })}
          {board.foundations.map((pile, i) => {
            const loc: Location = { kind: 'foundation', index: i };
            const top = pile[pile.length - 1];
            return (
              <Foundation
                key={`found-${i}`}
                index={i}
                pile={pile}
                target={targets.has(key(loc))}
                selected={selection?.from.kind === 'foundation' && selection.from.index === i}
                lifted={top !== undefined && lifted.has(top)}
                enabled={enabled}
                // Tapping a filled foundation selects its top card (or, with another
                // selection active, tries to place that selection here).
                onActivate={guard(() => (top !== undefined ? game.onCard(loc, 0) : game.onPile(loc)))}
                onPress={(e) => press(e, loc, 1)}
              />
            );
          })}
        </div>

        <div className="board__tableau" style={{ minHeight: layout.tableauH }}>
          {board.tableau.map((cards, i) => {
            const loc: Location = { kind: 'tableau', index: i };
            const isSel = selection?.from.kind === 'tableau' && selection.from.index === i;
            return (
              <Tableau
                key={`col-${i}`}
                index={i}
                cards={cards}
                offset={fanOffset(cards.length, layout)}
                selectedFrom={isSel ? cards.length - selection.count : null}
                lifted={lifted}
                hinted={hinted}
                target={targets.has(key(loc))}
                enabled={enabled}
                onCard={guard((ci: number) => game.onCard(loc, ci))}
                onEmpty={guard(() => game.onPile(loc))}
                onQuickMove={(ci) => game.onQuickMove(loc, ci)}
                onPress={(e, ci) => press(e, loc, cards.length - ci)}
              />
            );
          })}
        </div>
      </div>

      {drag && (
        <div className="drag-ghost" ref={setGhost} style={{ left: drag.originX, top: drag.originY }} aria-hidden="true">
          {drag.cards.map((card, i) => (
            <Card key={card} card={card} selected style={{ top: `${i * ghostOffset}px` }} />
          ))}
        </div>
      )}
    </div>
  );
}
