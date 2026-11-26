import { DECK_SIZE, type Card } from './card';

export const FREE_CELL_COUNT = 4;
export const FOUNDATION_COUNT = 4;
export const TABLEAU_COUNT = 8;

/**
 * Board position. Pure data, safe to JSON-serialise.
 *
 * - `tableau[c]` lists cards from the deepest (index 0) to the exposed top card (last index).
 * - `foundations[s]` is the pile for suit index s (C, D, H, S), Ace first.
 * - `freeCells[i]` is a card or null.
 */
export interface Board {
  freeCells: (Card | null)[];
  foundations: Card[][];
  tableau: Card[][];
}

export type PileKind = 'tableau' | 'freecell' | 'foundation';

export interface Location {
  kind: PileKind;
  index: number;
}

/** A move of `count` cards from the top of `from` to `to`. */
export interface Move {
  from: Location;
  to: Location;
  count: number;
}

export type GameStatus = 'playing' | 'won';

/**
 * Wall-clock timer. Elapsed time is always derived from timestamps, never
 * accumulated by ticking, so it stays correct across background tabs,
 * device sleep and browser restarts.
 */
export interface TimerState {
  /** Epoch ms of the first valid move, or null if the clock has not started. */
  startedAt: number | null;
  /** Epoch ms when the game was won, or null while still running. */
  stoppedAt: number | null;
}

export interface GameSession {
  dealNumber: number;
  board: Board;
  /** Board snapshots taken before each valid move (most recent last). */
  history: Board[];
  /** Total valid moves made in this session. Never decremented by Undo. */
  moveCount: number;
  status: GameStatus;
  timer: TimerState;
}

export function emptyBoard(): Board {
  return {
    freeCells: Array.from({ length: FREE_CELL_COUNT }, () => null),
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    tableau: Array.from({ length: TABLEAU_COUNT }, () => []),
  };
}

export function cloneBoard(board: Board): Board {
  return {
    freeCells: board.freeCells.slice(),
    foundations: board.foundations.map((p) => p.slice()),
    tableau: board.tableau.map((c) => c.slice()),
  };
}

export function allCards(board: Board): Card[] {
  const cards: Card[] = [];
  for (const c of board.freeCells) if (c !== null) cards.push(c);
  for (const p of board.foundations) cards.push(...p);
  for (const col of board.tableau) cards.push(...col);
  return cards;
}

/** True when the board holds each of the 52 cards exactly once in a correctly shaped layout. */
export function isCompleteBoard(board: Board): boolean {
  if (
    board.freeCells.length !== FREE_CELL_COUNT ||
    board.foundations.length !== FOUNDATION_COUNT ||
    board.tableau.length !== TABLEAU_COUNT
  ) {
    return false;
  }
  const cards = allCards(board);
  if (cards.length !== DECK_SIZE) return false;
  const seen = new Set(cards);
  return seen.size === DECK_SIZE && cards.every((c) => c >= 0 && c < DECK_SIZE);
}

export function sameLocation(a: Location, b: Location): boolean {
  return a.kind === b.kind && a.index === b.index;
}

export function getElapsedMs(timer: TimerState, now: number): number {
  if (timer.startedAt === null) return 0;
  const end = timer.stoppedAt ?? now;
  return Math.max(0, end - timer.startedAt);
}

/** MM:SS with unbounded minutes (e.g. 125:07). */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
