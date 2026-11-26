import { rankOf, suitIndexOf } from './card';
import type { Board, Move } from './gameState';
import { canMoveToFoundation } from './moveValidator';
import { isWon } from './winCondition';

/**
 * Auto Complete is offered only when finishing is guaranteed by foundation
 * moves alone: every tableau column is ordered so that ranks never increase
 * towards the exposed card. Then the lowest remaining card of any suit is
 * always exposed (on a column top or in a free cell) and is always the next
 * card its foundation needs, so no move can ever block another card.
 */
export function canAutoComplete(board: Board): boolean {
  if (isWon(board)) return false;
  return board.tableau.every((col) => {
    for (let i = 1; i < col.length; i++) {
      if (rankOf(col[i]) > rankOf(col[i - 1])) return false;
    }
    return true;
  });
}

/** The next foundation move (lowest rank first), or null if none is available. */
export function nextFoundationMove(board: Board): Move | null {
  let best: Move | null = null;
  let bestRank = Infinity;
  const consider = (card: number, move: Omit<Move, 'to'>) => {
    const f = suitIndexOf(card);
    if (canMoveToFoundation(board, card, f) && rankOf(card) < bestRank) {
      bestRank = rankOf(card);
      best = { ...move, to: { kind: 'foundation', index: f } };
    }
  };
  board.freeCells.forEach((card, i) => {
    if (card !== null) consider(card, { from: { kind: 'freecell', index: i }, count: 1 });
  });
  board.tableau.forEach((col, i) => {
    if (col.length > 0) consider(col[col.length - 1], { from: { kind: 'tableau', index: i }, count: 1 });
  });
  return best;
}
