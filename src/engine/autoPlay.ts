import { rankOf, suitIndexOf, type Card } from './card';
import type { Board, Move } from './gameState';
import { canMoveToFoundation } from './moveValidator';

/**
 * The card each foundation needs next (one per suit, none for a completed
 * suit): rank = pile length + 1. Used to hint those cards in the tableau.
 */
export function nextFoundationCards(board: Board): Card[] {
  const out: Card[] = [];
  board.foundations.forEach((pile, suit) => {
    if (pile.length < 13) out.push(pile.length * 4 + suit);
  });
  return out;
}

/**
 * Auto-play: after every player move, any exposed card (free cell or top of a
 * tableau column) that can legally go to its foundation is moved there
 * automatically, lowest rank first, except cards in `pinned` (cards the
 * player deliberately took back from a foundation).
 */
export function nextAutoPlayMove(board: Board, pinned: readonly Card[]): Move | null {
  let best: Move | null = null;
  let bestRank = Infinity;
  const consider = (card: Card, from: Move['from']) => {
    if (pinned.includes(card)) return;
    const f = suitIndexOf(card);
    if (canMoveToFoundation(board, card, f) && rankOf(card) < bestRank) {
      bestRank = rankOf(card);
      best = { from, to: { kind: 'foundation', index: f }, count: 1 };
    }
  };
  board.freeCells.forEach((card, i) => {
    if (card !== null) consider(card, { kind: 'freecell', index: i });
  });
  board.tableau.forEach((col, i) => {
    if (col.length > 0) consider(col[col.length - 1], { kind: 'tableau', index: i });
  });
  return best;
}
