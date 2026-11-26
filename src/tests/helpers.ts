import { parseCard } from '../engine/card';
import { emptyBoard, type Board } from '../engine/gameState';

/** Build a board from card codes. Unlisted piles stay empty. */
export function board(spec: {
  tableau?: string[][];
  freeCells?: (string | null)[];
  foundations?: string[][];
}): Board {
  const b = emptyBoard();
  spec.tableau?.forEach((col, i) => (b.tableau[i] = col.map(parseCard)));
  spec.freeCells?.forEach((c, i) => (b.freeCells[i] = c === null ? null : parseCard(c)));
  spec.foundations?.forEach((p, i) => (b.foundations[i] = p.map(parseCard)));
  return b;
}

const RANKS = 'A23456789TJQK';
/** Foundation pile for a suit up to (and including) the given rank. */
export function pileUpTo(suit: string, rank: number): string[] {
  return Array.from({ length: rank }, (_, i) => RANKS[i] + suit);
}
