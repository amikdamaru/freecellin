import { describe, expect, it } from 'vitest';
import { canAutoComplete, nextFoundationMove } from '../engine/autoComplete';
import { generateDeal } from '../engine/dealGenerator';
import { canUndo, classifyMove, createSession, findQuickMove, performMove, retry, undo } from '../engine/gameActions';
import { allCards, isCompleteBoard, type GameSession, type Location, type Move } from '../engine/gameState';
import { validDestinations } from '../engine/moveValidator';
import { isWon } from '../engine/winCondition';
import { board, pileUpTo } from './helpers';

const T = (index: number): Location => ({ kind: 'tableau', index });
const F = (index: number): Location => ({ kind: 'freecell', index });
const H = (index: number): Location => ({ kind: 'foundation', index });

function mustMove(s: GameSession, move: Move, now = 1000): GameSession {
  const r = performMove(s, move, now);
  if (!r.ok) throw new Error(`move failed: ${r.reason}`);
  return r.session;
}

describe('session lifecycle', () => {
  it('creates a fresh session with the timer not started', () => {
    const s = createSession(1);
    expect(s.moveCount).toBe(0);
    expect(s.history).toEqual([]);
    expect(s.status).toBe('playing');
    expect(s.timer).toEqual({ startedAt: null, stoppedAt: null });
    expect(s.board).toEqual(generateDeal(1));
  });

  it('counts each valid move once and starts the timer on the first move only', () => {
    let s = createSession(1);
    s = mustMove(s, { from: T(0), to: F(0), count: 1 }, 5000);
    expect(s.moveCount).toBe(1);
    expect(s.timer.startedAt).toBe(5000);
    s = mustMove(s, { from: T(1), to: F(1), count: 1 }, 9000);
    expect(s.moveCount).toBe(2);
    expect(s.timer.startedAt).toBe(5000);
  });

  it('ignores invalid moves completely (no move count, no timer)', () => {
    const s = createSession(1);
    const r = performMove(s, { from: T(0), to: H(0), count: 1 }, 5000); // 6S is not an Ace
    expect(r.ok).toBe(false);
    expect(s.moveCount).toBe(0);
    expect(s.timer.startedAt).toBeNull();
  });

  it('undo restores the board but never decrements moves or rewinds the timer', () => {
    let s = createSession(1);
    for (let i = 0; i < 4; i++) s = mustMove(s, { from: T(i), to: F(i), count: 1 }, 1000 + i);
    expect(s.moveCount).toBe(4);
    const before = s.board;
    s = undo(s);
    expect(s.moveCount).toBe(4);
    expect(s.timer.startedAt).toBe(1000);
    expect(s.board.freeCells[3]).toBeNull();
    expect(isCompleteBoard(s.board)).toBe(true);
    s = mustMove(s, { from: T(3), to: F(3), count: 1 }, 2000);
    expect(s.moveCount).toBe(5);
    expect(s.board).toEqual(before);
    while (canUndo(s)) s = undo(s);
    expect(s.board).toEqual(generateDeal(1));
    expect(s.moveCount).toBe(5);
    expect(s.timer.startedAt).toBe(1000);
    expect(canUndo(s)).toBe(false);
    expect(undo(s)).toBe(s);
  });

  it('undo of a sequence move restores the whole sequence', () => {
    let s: GameSession = {
      ...createSession(1),
      board: board({ tableau: [['9S', '8H', '7C'], ['TD'], ['KS'], ['KH'], ['KC'], ['KD'], ['QS'], ['QH']] }),
    };
    s = mustMove(s, { from: T(0), to: T(1), count: 3 });
    expect(s.moveCount).toBe(1);
    expect(s.board.tableau[1].length).toBe(4);
    s = undo(s);
    expect(s.board.tableau[0].length).toBe(3);
    expect(s.board.tableau[1].length).toBe(1);
  });

  it('retry restores the same deal and resets moves, history and timer', () => {
    let s = createSession(617);
    s = mustMove(s, { from: T(0), to: F(0), count: 1 }, 5000);
    const r = retry(s);
    expect(r.dealNumber).toBe(617);
    expect(r.board).toEqual(generateDeal(617));
    expect(r.moveCount).toBe(0);
    expect(r.history).toEqual([]);
    expect(r.timer.startedAt).toBeNull();
    expect(r.status).toBe('playing');
  });

  it('keeps all 52 cards through a long random playout with undos', () => {
    let s = createSession(31999);
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let step = 0; step < 400; step++) {
      if (rnd() < 0.15 && canUndo(s)) {
        s = undo(s);
      } else {
        const sources: Location[] = [...s.board.tableau.map((_, i) => T(i)), ...s.board.freeCells.map((_, i) => F(i))];
        const from = sources[Math.floor(rnd() * sources.length)];
        const dests = validDestinations(s.board, from, 1);
        if (dests.length) s = mustMove(s, { from, to: dests[Math.floor(rnd() * dests.length)], count: 1 });
      }
      expect(isCompleteBoard(s.board)).toBe(true);
    }
    s.history.forEach((h) => expect(isCompleteBoard(h)).toBe(true));
  });
});

describe('move classification', () => {
  const b = board({ tableau: [['9S', '8H'], ['9C'], []] });
  it('classifies foundation / arrange / move', () => {
    expect(classifyMove(b, { from: T(0), to: H(2), count: 1 })).toBe('foundation');
    expect(classifyMove(b, { from: T(0), to: T(1), count: 1 })).toBe('arrange');
    expect(classifyMove(b, { from: T(0), to: T(2), count: 1 })).toBe('move');
    expect(classifyMove(b, { from: T(0), to: F(0), count: 1 })).toBe('move');
  });
});

describe('win condition and auto complete', () => {
  function nearlyWon(): GameSession {
    return {
      ...createSession(1),
      board: board({
        tableau: [['KH'], ['KS', 'QH']],
        freeCells: ['KD', null, 'QS', null],
        foundations: [pileUpTo('C', 13), pileUpTo('D', 12), pileUpTo('H', 11), pileUpTo('S', 11)],
      }),
      timer: { startedAt: 100, stoppedAt: null },
      moveCount: 40,
    };
  }

  it('detects the win exactly once, stops the timer and blocks further moves', () => {
    let s = nearlyWon();
    expect(canAutoComplete(s.board)).toBe(true);
    let guard = 0;
    let wins = 0;
    while (s.status === 'playing' && guard++ < 60) {
      const m = nextFoundationMove(s.board);
      expect(m).not.toBeNull();
      const r = performMove(s, m!, 5000);
      expect(r.ok && r.kind).toBe('foundation');
      if (r.ok) {
        if (r.won) wins++;
        s = r.session;
      }
    }
    expect(wins).toBe(1);
    expect(isWon(s.board)).toBe(true);
    expect(allCards(s.board).length).toBe(52);
    expect(s.status).toBe('won');
    expect(s.timer.stoppedAt).toBe(5000);
    expect(s.moveCount).toBe(45);
    expect(performMove(s, { from: T(0), to: T(1), count: 1 }, 6000)).toEqual({ ok: false, reason: 'game-over' });
    expect(canUndo(s)).toBe(false);
  });

  it('is not offered while a column hides a lower card under a higher one', () => {
    const b = board({
      tableau: [['QH', 'KH']],
      foundations: [pileUpTo('C', 13), pileUpTo('D', 13), pileUpTo('H', 11), pileUpTo('S', 13)],
    });
    expect(canAutoComplete(b)).toBe(false);
  });

  it('is not offered on a fresh deal', () => {
    expect(canAutoComplete(generateDeal(1))).toBe(false);
  });
});

describe('quick move (double-click)', () => {
  it('prefers foundation, then building, then an empty column, then a free cell', () => {
    const b = board({ tableau: [['AH'], ['9S', '8D'], ['9C'], ['KD']] });
    expect(findQuickMove(b, T(0), 1)?.to).toEqual(H(2));
    expect(findQuickMove(b, T(1), 1)?.to).toEqual(T(2));
    const c = board({ tableau: [['5C'], ['KD'], ['KH']] });
    expect(findQuickMove(c, T(0), 1)?.to).toEqual(T(3));
    const full = board({ tableau: [['5C'], ['KD'], ['KH'], ['KS'], ['KC'], ['QD'], ['QH'], ['QS']] });
    expect(findQuickMove(full, T(0), 1)?.to).toEqual(F(0));
  });
});
