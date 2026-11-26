import { isRed, rankOf, suitIndexOf, type Card } from './card';
import type { Board, Location, Move } from './gameState';
import { sameLocation } from './gameState';

export type InvalidReason =
  | 'same-location'
  | 'empty-source'
  | 'bad-count'
  | 'not-a-sequence'
  | 'from-foundation'
  | 'foundation-mismatch'
  | 'freecell-occupied'
  | 'freecell-single-card'
  | 'tableau-mismatch'
  | 'exceeds-capacity';

export type ValidationResult = { ok: true } | { ok: false; reason: InvalidReason };

/** True if `card` may be placed directly on `target` in the tableau. */
export function canStackOn(card: Card, target: Card): boolean {
  return rankOf(target) === rankOf(card) + 1 && isRed(target) !== isRed(card);
}

/** True if the cards form a descending, alternating-colour run (index 0 is the deepest). */
export function isOrderedRun(cards: readonly Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    if (!canStackOn(cards[i], cards[i - 1])) return false;
  }
  return true;
}

/** Index of the deepest card of the ordered run at the top of a column (column.length if empty). */
export function runStartIndex(column: readonly Card[]): number {
  if (column.length === 0) return 0;
  let i = column.length - 1;
  while (i > 0 && canStackOn(column[i], column[i - 1])) i--;
  return i;
}

/**
 * Maximum number of cards that can be moved as one unit:
 * (empty free cells + 1) × 2^(empty tableau columns).
 * Callers must exclude the destination column from `emptyColumns` when it is empty.
 */
export function maxMovableCards(emptyFreeCells: number, emptyColumns: number): number {
  return (emptyFreeCells + 1) * 2 ** Math.max(0, emptyColumns);
}

export function countEmptyFreeCells(board: Board): number {
  return board.freeCells.filter((c) => c === null).length;
}

export function countEmptyColumns(board: Board, exclude?: number): number {
  return board.tableau.reduce((n, col, i) => (col.length === 0 && i !== exclude ? n + 1 : n), 0);
}

/** Capacity for moving a run to the given tableau column. */
export function capacityForTableauMove(board: Board, toColumn: number): number {
  const destEmpty = board.tableau[toColumn].length === 0;
  return maxMovableCards(countEmptyFreeCells(board), countEmptyColumns(board, destEmpty ? toColumn : undefined));
}

/** The top `count` cards at a location (deepest first), or null if unavailable. */
export function cardsAt(board: Board, loc: Location, count: number): Card[] | null {
  if (count < 1) return null;
  switch (loc.kind) {
    case 'tableau': {
      const col = board.tableau[loc.index];
      if (!col || count > col.length) return null;
      return col.slice(col.length - count);
    }
    case 'freecell': {
      const c = board.freeCells[loc.index];
      return c === null || c === undefined || count !== 1 ? null : [c];
    }
    case 'foundation': {
      const pile = board.foundations[loc.index];
      if (!pile || count !== 1 || pile.length === 0) return null;
      return [pile[pile.length - 1]];
    }
  }
}

/** Whether the top `count` cards of a location may be picked up at all. */
export function canPickUp(board: Board, loc: Location, count: number): boolean {
  if (loc.kind === 'foundation') return false;
  const cards = cardsAt(board, loc, count);
  return cards !== null && isOrderedRun(cards);
}

export function canMoveToFoundation(board: Board, card: Card, foundationIndex: number): boolean {
  const pile = board.foundations[foundationIndex];
  if (!pile || suitIndexOf(card) !== foundationIndex) return false;
  return rankOf(card) === pile.length + 1;
}

export function validateMove(board: Board, move: Move): ValidationResult {
  const { from, to, count } = move;
  if (sameLocation(from, to)) return { ok: false, reason: 'same-location' };
  if (from.kind === 'foundation') return { ok: false, reason: 'from-foundation' };
  if (!Number.isInteger(count) || count < 1) return { ok: false, reason: 'bad-count' };

  const moving = cardsAt(board, from, count);
  if (!moving) {
    const sourceEmpty =
      from.kind === 'freecell' ? board.freeCells[from.index] == null : (board.tableau[from.index]?.length ?? 0) === 0;
    return { ok: false, reason: sourceEmpty ? 'empty-source' : 'bad-count' };
  }
  if (!isOrderedRun(moving)) return { ok: false, reason: 'not-a-sequence' };

  switch (to.kind) {
    case 'foundation': {
      if (count !== 1) return { ok: false, reason: 'foundation-mismatch' };
      return canMoveToFoundation(board, moving[0], to.index) ? { ok: true } : { ok: false, reason: 'foundation-mismatch' };
    }
    case 'freecell': {
      if (count !== 1) return { ok: false, reason: 'freecell-single-card' };
      if (to.index < 0 || to.index >= board.freeCells.length) return { ok: false, reason: 'freecell-occupied' };
      return board.freeCells[to.index] === null ? { ok: true } : { ok: false, reason: 'freecell-occupied' };
    }
    case 'tableau': {
      const dest = board.tableau[to.index];
      if (!dest) return { ok: false, reason: 'tableau-mismatch' };
      if (dest.length > 0 && !canStackOn(moving[0], dest[dest.length - 1])) {
        return { ok: false, reason: 'tableau-mismatch' };
      }
      if (count > capacityForTableauMove(board, to.index)) return { ok: false, reason: 'exceeds-capacity' };
      return { ok: true };
    }
  }
}

/** All locations the top `count` cards of `from` could legally move to. */
export function validDestinations(board: Board, from: Location, count: number): Location[] {
  const out: Location[] = [];
  const consider = (to: Location) => {
    if (validateMove(board, { from, to, count }).ok) out.push(to);
  };
  board.foundations.forEach((_, i) => consider({ kind: 'foundation', index: i }));
  board.freeCells.forEach((_, i) => consider({ kind: 'freecell', index: i }));
  board.tableau.forEach((_, i) => consider({ kind: 'tableau', index: i }));
  return out;
}
