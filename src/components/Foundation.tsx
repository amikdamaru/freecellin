import type { PointerEvent } from 'react';
import { SUIT_NAME, SUITS, type Card as CardId } from '../engine/card';
import { Card } from './Card';
import { SuitIcon } from './icons';

interface Props {
  index: number;
  pile: CardId[];
  target: boolean;
  /** The top card is selected (to be moved back to a column). */
  selected: boolean;
  lifted: boolean;
  enabled: boolean;
  onActivate: () => void;
  onPress: (e: PointerEvent<HTMLDivElement>) => void;
}

export function Foundation({ index, pile, target, selected, lifted, enabled, onActivate, onPress }: Props) {
  const suit = SUITS[index];
  const top = pile[pile.length - 1];
  const below = pile[pile.length - 2];
  return (
    <div
      className={`slot slot--foundation${target ? ' slot--target' : ''}`}
      data-drop={`foundation:${index}`}
      role="button"
      tabIndex={top === undefined ? 0 : -1}
      aria-label={`${SUIT_NAME[suit]} foundation, ${pile.length} of 13`}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <SuitIcon suit={suit} className={`slot__suit slot__suit--${suit === 'H' || suit === 'D' ? 'red' : 'black'}`} />
      {/* The card underneath stays rendered so it shows while the top card is lifted or animates away. */}
      {below !== undefined && <Card key={below} card={below} />}
      {top !== undefined && (
        <Card
          key={top}
          card={top}
          selected={selected}
          lifted={lifted}
          interactive={enabled}
          onPointerDown={enabled ? onPress : undefined}
          onClick={onActivate}
        />
      )}
    </div>
  );
}
