import type { PointerEvent } from 'react';
import type { Card as CardId } from '../engine/card';
import { runStartIndex } from '../engine/moveValidator';
import { Card } from './Card';

interface Props {
  index: number;
  cards: CardId[];
  offset: number;
  /** Selected run starts at this card index (or null). */
  selectedFrom: number | null;
  lifted: ReadonlySet<number>;
  /** Cards the foundations need next (highlighted). */
  hinted: ReadonlySet<number>;
  target: boolean;
  enabled: boolean;
  onCard: (cardIndex: number) => void;
  onEmpty: () => void;
  onQuickMove: (cardIndex: number) => void;
  onPress: (e: PointerEvent<HTMLDivElement>, cardIndex: number) => void;
}

export function Tableau({ index, cards, offset, selectedFrom, lifted, hinted, target, enabled, onCard, onEmpty, onQuickMove, onPress }: Props) {
  const movableFrom = runStartIndex(cards);
  return (
    <div
      className={`column${target ? ' column--target' : ''}`}
      data-drop={`tableau:${index}`}
      style={{ minHeight: `calc(var(--ch) + ${Math.max(0, cards.length - 1) * offset}px)` }}
      onClick={onEmpty}
    >
      <div
        className="slot slot--column"
        role="button"
        tabIndex={cards.length === 0 ? 0 : -1}
        aria-label={`Column ${index + 1}${cards.length === 0 ? ', empty' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEmpty();
          }
        }}
      />
      {cards.map((card, i) => {
        const pickable = enabled && i >= movableFrom;
        return (
          <Card
            key={card}
            card={card}
            style={{ top: `${i * offset}px`, zIndex: i + 1 }}
            selected={selectedFrom !== null && i >= selectedFrom}
            lifted={lifted.has(card)}
            hint={hinted.has(card)}
            interactive={pickable}
            onPointerDown={pickable ? (e) => onPress(e, i) : undefined}
            onClick={() => onCard(i)}
            onDoubleClick={pickable ? () => onQuickMove(i) : undefined}
          />
        );
      })}
    </div>
  );
}
