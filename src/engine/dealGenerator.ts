/**
 * Microsoft FreeCell numbered-deal generator.
 *
 * Algorithm (Microsoft's original shuffle, as documented at
 * https://rosettacode.org/wiki/Deal_cards_for_FreeCell and used by
 * macroxue/freecell and shlomif/fc-solve):
 *
 *   1. Seed the Microsoft C runtime LCG with the deal number:
 *        state = (214013 * state + 2531011) mod 2^31,  rand = state >> 16  (0..32767)
 *   2. Start with the 52-card deck ordered AC AD AH AS 2C 2D ... KS.
 *   3. Until the deck is empty: pick index rand() mod length, swap that card with
 *      the last card, remove it and deal it.
 *   4. Deal cards row by row across the 8 columns (card k goes to column k mod 8).
 *
 * The algorithm is independently re-implemented here; no third-party code is copied.
 * Valid for deal numbers 1..2^31-1 (this app uses 1..1,000,000).
 */
import { DECK_SIZE, type Card } from './card';
import { emptyBoard, TABLEAU_COUNT, type Board } from './gameState';

export const MIN_DEAL = 1;
export const MAX_DEAL = 1_000_000;

/**
 * The eight deals in 1..1,000,000 known to be unsolvable under standard rules
 * (listed by macroxue/freecell, which ships solver results for deals 1..1,000,000).
 * Excluding these does NOT mean the app has verified every other deal itself.
 */
export const UNSOLVABLE_DEALS: ReadonlySet<number> = new Set([
  11982, 146692, 186216, 455889, 495505, 512118, 517776, 781948,
]);

const MOD_2_31 = 2147483648;

/** Microsoft C runtime `rand()` seeded with `seed`. */
export function createMsRandom(seed: number): () => number {
  let state = seed;
  return () => {
    // 214013 * (2^31 - 1) < 2^53, so plain double arithmetic is exact here.
    state = (state * 214013 + 2531011) % MOD_2_31;
    return Math.floor(state / 65536);
  };
}

export function isValidDealNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_DEAL && n <= MAX_DEAL;
}

/** Cards in the order they are dealt (row by row, left to right). */
export function dealOrder(dealNumber: number): Card[] {
  if (!Number.isInteger(dealNumber) || dealNumber < 1 || dealNumber >= MOD_2_31) {
    throw new RangeError(`Deal number out of range: ${dealNumber}`);
  }
  const rand = createMsRandom(dealNumber);
  const deck: Card[] = Array.from({ length: DECK_SIZE }, (_, i) => i);
  const dealt: Card[] = [];
  for (let left = DECK_SIZE; left > 0; left--) {
    const j = rand() % left;
    const picked = deck[j];
    deck[j] = deck[left - 1];
    deck[left - 1] = picked;
    dealt.push(picked);
  }
  return dealt;
}

/** Build the initial board: 8 tableau columns, empty free cells and foundations. */
export function generateDeal(dealNumber: number): Board {
  const board = emptyBoard();
  dealOrder(dealNumber).forEach((card, k) => {
    board.tableau[k % TABLEAU_COUNT].push(card);
  });
  return board;
}

/** Uniform random integer in [min, max] using crypto when available. */
function randomInt(min: number, max: number): number {
  const span = max - min + 1;
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    // Rejection sampling to avoid modulo bias.
    const limit = Math.floor(0x100000000 / span) * span;
    do {
      c.getRandomValues(buf);
    } while (buf[0] >= limit);
    return min + (buf[0] % span);
  }
  return min + Math.floor(Math.random() * span);
}

/**
 * Pick a deal number for New Game: in 1..1,000,000, never a known unsolvable
 * deal and never the same as `previous`.
 */
export function pickRandomDeal(previous?: number | null, random: () => number = () => randomInt(MIN_DEAL, MAX_DEAL)): number {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const n = random();
    if (isValidDealNumber(n) && !UNSOLVABLE_DEALS.has(n) && n !== previous) return n;
  }
  // Practically unreachable; deterministic safe fallback.
  return previous === 1 ? 2 : 1;
}
