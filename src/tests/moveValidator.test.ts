import { describe, expect, it } from 'vitest';
import { parseCard } from '../engine/card';
import {
  canStackOn,
  capacityForTableauMove,
  isOrderedRun,
  maxMovableCards,
  runStartIndex,
  validateMove,
  validDestinations,
} from '../engine/moveValidator';
import type { Location } from '../engine/gameState';
import { board, pileUpTo } from './helpers';

const T = (index: number): Location => ({ kind: 'tableau', index });
const F = (index: number): Location => ({ kind: 'freecell', index });
const H = (index: number): Location => ({ kind: 'foundation', index }); // C=0 D=1 H=2 S=3

describe('stacking rules', () => {
  it('requires descending rank and alternating colour', () => {
    expect(canStackOn(parseCard('8H'), parseCard('9S'))).toBe(true);
    expect(canStackOn(parseCard('8D'), parseCard('9C'))).toBe(true);
    expect(canStackOn(parseCard('8S'), parseCard('9C'))).toBe(false); // same colour
    expect(canStackOn(parseCard('8H'), parseCard('9D'))).toBe(false); // same colour
    expect(canStackOn(parseCard('7H'), parseCard('9S'))).toBe(false); // wrong rank
    expect(canStackOn(parseCard('TH'), parseCard('9S'))).toBe(false); // ascending
  });

  it('recognises ordered runs', () => {
    expect(isOrderedRun(['9S', '8H', '7C'].map(parseCard))).toBe(true);
    expect(isOrderedRun(['9S', '8H', '7D'].map(parseCard))).toBe(false);
    expect(runStartIndex(['KS', '9S', '8H', '7C'].map(parseCard))).toBe(1);
  });
});

describe('capacity formula (F+1) * 2^C', () => {
  it('computes the classic values', () => {
    expect(maxMovableCards(0, 0)).toBe(1);
    expect(maxMovableCards(4, 0)).toBe(5);
    expect(maxMovableCards(1, 1)).toBe(4);
    expect(maxMovableCards(4, 2)).toBe(20);
    expect(maxMovableCards(2, 3)).toBe(24);
  });

  it('does not count an empty destination column', () => {
    const b = board({ tableau: [['9S', '8H', '7C'], ['KD'], [], []], freeCells: ['2C', '2D', '2H', null] });
    expect(capacityForTableauMove(b, 1)).toBe(2 * 2 ** 6); // 1 free cell, 6 empty columns
    expect(capacityForTableauMove(b, 2)).toBe(2 * 2 ** 5); // destination excluded
  });
});

describe('validateMove', () => {
  it('moves a valid sequence when capacity allows', () => {
    const b = board({
      tableau: [['9S', '8H', '7C'], ['TD'], ['KS'], ['KH'], ['KC'], ['KD'], ['QS'], ['QH']],
      freeCells: [null, null, '2C', '2D'],
    });
    // 2 empty cells, 0 empty columns => capacity 3
    expect(validateMove(b, { from: T(0), to: T(1), count: 3 })).toEqual({ ok: true });
  });

  it('rejects a sequence that exceeds capacity', () => {
    const b = board({
      tableau: [['9S', '8H', '7C'], ['TD'], ['KS'], ['KH'], ['KC'], ['KD'], ['QS'], ['QH']],
      freeCells: [null, '3C', '2C', '2D'],
    });
    // 1 empty cell, 0 empty columns => capacity 2
    expect(validateMove(b, { from: T(0), to: T(1), count: 3 })).toEqual({ ok: false, reason: 'exceeds-capacity' });
    expect(validateMove(b, { from: T(0), to: T(1), count: 2 })).toEqual({ ok: false, reason: 'tableau-mismatch' });
  });

  it('halves capacity when the only empty column is the destination', () => {
    const b = board({
      tableau: [['9S', '8H', '7C', '6D'], [], ['KS'], ['KH'], ['KC'], ['KD'], ['QS'], ['QH']],
      freeCells: [null, '3C', '2C', '2D'],
    });
    // 1 empty cell; destination column empty and excluded => 2
    expect(validateMove(b, { from: T(0), to: T(1), count: 2 }).ok).toBe(true);
    expect(validateMove(b, { from: T(0), to: T(1), count: 3 })).toEqual({ ok: false, reason: 'exceeds-capacity' });
    expect(validDestinations(b, T(0), 3)).toEqual([]);
  });

  it('rejects unordered stacks and same-colour builds', () => {
    const b = board({ tableau: [['9S', '8D', '7D'], ['TD'], ['9C']] });
    expect(validateMove(b, { from: T(0), to: T(1), count: 2 })).toEqual({ ok: false, reason: 'not-a-sequence' });
    expect(validateMove(b, { from: T(2), to: T(1), count: 1 }).ok).toBe(true);
    expect(validateMove(b, { from: T(0), to: T(2), count: 1 })).toEqual({ ok: false, reason: 'tableau-mismatch' });
  });

  it('enforces free cell rules', () => {
    const b = board({ tableau: [['9S', '8H']], freeCells: ['2C', null, null, null] });
    expect(validateMove(b, { from: T(0), to: F(1), count: 1 }).ok).toBe(true);
    expect(validateMove(b, { from: T(0), to: F(0), count: 1 })).toEqual({ ok: false, reason: 'freecell-occupied' });
    expect(validateMove(b, { from: T(0), to: F(1), count: 2 })).toEqual({ ok: false, reason: 'freecell-single-card' });
    expect(validateMove(b, { from: F(2), to: T(0), count: 1 })).toEqual({ ok: false, reason: 'empty-source' });
  });

  it('enforces foundation rules (suit, Ace first, ascending)', () => {
    const b = board({ tableau: [['AH'], ['2H'], ['3S'], ['2C']], foundations: [['AC'], [], [], ['AS']] });
    expect(validateMove(b, { from: T(0), to: H(2), count: 1 }).ok).toBe(true);
    expect(validateMove(b, { from: T(0), to: H(1), count: 1 }).ok).toBe(false); // wrong suit pile
    expect(validateMove(b, { from: T(1), to: H(2), count: 1 }).ok).toBe(false); // 2 before Ace
    expect(validateMove(b, { from: T(2), to: H(3), count: 1 }).ok).toBe(false); // 3S on AS
    expect(validateMove(b, { from: T(3), to: H(0), count: 1 }).ok).toBe(true);
  });

  it('lets the top foundation card go back onto a tableau column (house rule)', () => {
    const b = board({
      tableau: [['9S'], ['4H'], [], ['5S']],
      freeCells: [null, null, null, null],
      foundations: [pileUpTo('C', 3), pileUpTo('D', 8), [], []],
    });
    // 8D (top of diamonds) onto black 9S: allowed.
    expect(validateMove(b, { from: H(1), to: T(0), count: 1 })).toEqual({ ok: true });
    // 3C onto red 4H: allowed. Onto an empty column: allowed.
    expect(validateMove(b, { from: H(0), to: T(1), count: 1 }).ok).toBe(true);
    expect(validateMove(b, { from: H(0), to: T(2), count: 1 }).ok).toBe(true);
    // Normal tableau rules still apply: 3C on 5S is wrong.
    expect(validateMove(b, { from: H(0), to: T(3), count: 1 })).toEqual({ ok: false, reason: 'tableau-mismatch' });
    // Only to columns: not to a free cell or another foundation.
    expect(validateMove(b, { from: H(0), to: F(0), count: 1 })).toEqual({ ok: false, reason: 'from-foundation' });
    expect(validateMove(b, { from: H(0), to: H(2), count: 1 })).toEqual({ ok: false, reason: 'from-foundation' });
    // One card only, and never from an empty pile.
    expect(validateMove(b, { from: H(0), to: T(2), count: 2 })).toEqual({ ok: false, reason: 'bad-count' });
    expect(validateMove(b, { from: H(2), to: T(2), count: 1 })).toEqual({ ok: false, reason: 'empty-source' });
    // Columns 3 and 5..8 are empty in this board; 4H and 5S do not accept 8D.
    expect(validDestinations(b, H(1), 1)).toEqual([T(0), T(2), T(4), T(5), T(6), T(7)]);
  });

  it('lets any card or run start an empty column', () => {
    const b = board({ tableau: [['5C', 'KH'], []], foundations: [pileUpTo('C', 3)] });
    expect(validateMove(b, { from: T(0), to: T(1), count: 1 }).ok).toBe(true);
  });
});

/**
 * Equivalence check: the capacity formula must equal the largest run that can be
 * transferred with single-card moves through f free cells and c empty columns.
 * Brute-force recursive model, independent of the formula.
 */
describe('sequence move equivalence with single-card moves', () => {
  function canTransfer(n: number, f: number, c: number): boolean {
    if (n <= f + 1) return true;
    if (c === 0) return false;
    // Park k cards in one empty column (using the other c-1 empties), move the
    // remaining n-k with c-1 empties, then bring the parked k back on top
    // (the parking column is still occupied, so again c-1 empties).
    for (let k = 1; k < n; k++) {
      if (canTransfer(k, f, c - 1) && canTransfer(n - k, f, c - 1)) return true;
    }
    return false;
  }
  it('matches (F+1)*2^C for small spaces', () => {
    for (let f = 0; f <= 4; f++) {
      for (let c = 0; c <= 3; c++) {
        const cap = maxMovableCards(f, c);
        expect(canTransfer(cap, f, c)).toBe(true);
        expect(canTransfer(cap + 1, f, c)).toBe(false);
      }
    }
  });
});
