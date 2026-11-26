import { memo, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { cardName, isRed, rankLabel, suitOf, type Card as CardId } from '../engine/card';
import { SuitIcon } from './icons';

export interface CardProps {
  card: CardId;
  selected?: boolean;
  /** Hidden while it is being dragged (the drag ghost shows it instead). */
  lifted?: boolean;
  interactive?: boolean;
  style?: CSSProperties;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

function CardView({ card, selected, lifted, interactive, style, onPointerDown, onClick, onDoubleClick }: CardProps) {
  const suit = suitOf(card);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };
  const className = [
    'card',
    isRed(card) ? 'card--red' : 'card--black',
    selected ? 'card--selected' : '',
    lifted ? 'card--lifted' : '',
    interactive ? 'card--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={style}
      data-card-id={card}
      role={onClick ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={cardName(card)}
      aria-pressed={onClick ? Boolean(selected) : undefined}
      onPointerDown={onPointerDown}
      onClick={
        onClick &&
        ((e) => {
          e.stopPropagation();
          onClick();
        })
      }
      onDoubleClick={
        onDoubleClick &&
        ((e) => {
          e.stopPropagation();
          onDoubleClick();
        })
      }
      onKeyDown={onClick ? onKeyDown : undefined}
    >
      <span className="card__index">
        <span className="card__rank">{rankLabel(card)}</span>
        <SuitIcon suit={suit} className="card__suit-small" />
      </span>
      <SuitIcon suit={suit} className="card__pip" />
      <span className="card__index card__index--bottom" aria-hidden="true">
        <span className="card__rank">{rankLabel(card)}</span>
        <SuitIcon suit={suit} className="card__suit-small" />
      </span>
    </div>
  );
}

export const Card = memo(CardView);
