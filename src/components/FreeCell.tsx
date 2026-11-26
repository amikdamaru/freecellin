import type { PointerEvent } from 'react';
import type { Card as CardId } from '../engine/card';
import { Card } from './Card';

interface Props {
  index: number;
  card: CardId | null;
  selected: boolean;
  lifted: boolean;
  target: boolean;
  enabled: boolean;
  onActivate: () => void;
  onQuickMove: () => void;
  onPress: (e: PointerEvent<HTMLDivElement>) => void;
}

export function FreeCell({ index, card, selected, lifted, target, enabled, onActivate, onQuickMove, onPress }: Props) {
  return (
    <div
      className={`slot slot--cell${target ? ' slot--target' : ''}`}
      data-drop={`freecell:${index}`}
      role="button"
      tabIndex={card === null ? 0 : -1}
      aria-label={`Free cell ${index + 1}${card === null ? ', empty' : ''}`}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {card !== null && (
        <Card
          card={card}
          selected={selected}
          lifted={lifted}
          interactive={enabled}
          onPointerDown={enabled ? onPress : undefined}
          onClick={onActivate}
          onDoubleClick={enabled ? onQuickMove : undefined}
        />
      )}
    </div>
  );
}
