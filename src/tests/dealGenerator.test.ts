import { describe, expect, it } from 'vitest';
import { cardCode, parseCard } from '../engine/card';
import { createMsRandom, dealOrder, generateDeal, pickRandomDeal, UNSOLVABLE_DEALS } from '../engine/dealGenerator';
import { allCards, isCompleteBoard } from '../engine/gameState';
import { REFERENCE_DEALS } from './fixtures';

function rowsOf(deal: number): string[][] {
  const board = generateDeal(deal);
  const rows: string[][] = [];
  for (let r = 0; r < 7; r++) {
    const row = board.tableau.map((col) => col[r]).filter((c) => c !== undefined).map(cardCode);
    rows.push(row);
  }
  return rows;
}

function parseFixture(text: string): string[][] {
  return text.trim().split('\n').map((line) => line.trim().split(/\s+/));
}

describe('Microsoft C rand()', () => {
  it('matches the documented MSVC LCG for seed 1 (41, 18467, 6334, ...)', () => {
    // Well-known first outputs of MSVC rand() after srand(1).
    const rand = createMsRandom(1);
    expect([rand(), rand(), rand(), rand(), rand()]).toEqual([41, 18467, 6334, 26500, 19169]);
  });
});

describe('generateDeal', () => {
  for (const deal of [1, 617, 11982]) {
    it(`deal #${deal} matches the Rosetta Code reference layout`, () => {
      expect(rowsOf(deal)).toEqual(parseFixture(REFERENCE_DEALS[deal]));
    });
  }

  it('deal #31999 is a complete, deterministic layout (no public verbatim fixture available)', () => {
    const a = generateDeal(31999);
    expect(isCompleteBoard(a)).toBe(true);
    expect(generateDeal(31999)).toEqual(a);
    expect(a).not.toEqual(generateDeal(31998));
  });

  it('produces 52 unique cards in 8 columns (7,7,7,7,6,6,6,6), empty cells and foundations', () => {
    for (const deal of [1, 2, 617, 11982, 31999, 500000, 1000000]) {
      const b = generateDeal(deal);
      expect(isCompleteBoard(b)).toBe(true);
      expect(b.tableau.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
      expect(b.freeCells).toEqual([null, null, null, null]);
      expect(b.foundations).toEqual([[], [], [], []]);
      expect(new Set(allCards(b)).size).toBe(52);
    }
  });

  it('is deterministic for the same deal number', () => {
    expect(dealOrder(123456)).toEqual(dealOrder(123456));
  });

  it('rejects out-of-range deal numbers', () => {
    expect(() => generateDeal(0)).toThrow();
    expect(() => generateDeal(1.5)).toThrow();
  });

  it('parses and formats card codes consistently', () => {
    expect(cardCode(parseCard('TD'))).toBe('TD');
    expect(parseCard('10h')).toBe(parseCard('TH'));
  });
});

describe('pickRandomDeal', () => {
  it('never returns a known unsolvable deal', () => {
    const queue = [...UNSOLVABLE_DEALS, 42];
    expect(pickRandomDeal(null, () => queue.shift()!)).toBe(42);
  });

  it('never repeats the previous deal', () => {
    const queue = [77, 77, 78];
    expect(pickRandomDeal(77, () => queue.shift()!)).toBe(78);
  });

  it('stays within 1..1,000,000 using the default source', () => {
    for (let i = 0; i < 2000; i++) {
      const n = pickRandomDeal(null);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(1_000_000);
      expect(UNSOLVABLE_DEALS.has(n)).toBe(false);
    }
  });

  it('lists exactly the eight known unsolvable deals', () => {
    expect([...UNSOLVABLE_DEALS].sort((a, b) => a - b)).toEqual([
      11982, 146692, 186216, 455889, 495505, 512118, 517776, 781948,
    ]);
  });
});
