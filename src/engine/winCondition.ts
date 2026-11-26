import { DECK_SIZE } from './card';
import type { Board } from './gameState';

/** The game is won when all 52 cards are on the foundations. */
export function isWon(board: Board): boolean {
  return board.foundations.reduce((n, pile) => n + pile.length, 0) === DECK_SIZE;
}
