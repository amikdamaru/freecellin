import { describe, expect, it } from 'vitest';
import { parseCard } from '../engine/card';
import { nextAutoPlayMove } from '../engine/autoPlay';
import { createSession, playMove, undo } from '../engine/gameActions';
import { isCompleteBoard, type GameSession, type Location } from '../engine/gameState';
import { createMemoryStore, loadGame, saveGame } from '../services/storage';
import { board, pileUpTo } from './helpers';

const T = (index: number): Location => ({ kind: 'tableau', index });
const F = (index: number): Location => ({ kind: 'freecell', index });
const H = (index: number): Location => ({ kind: 'foundation', index }); // C D H S

/** Session around a custom board, filled up so all 52 cards are present. */
function sessionWith(spec: Parameters<typeof board>[0]): GameSession {
  const b = board(spec);
  const present = new Set([...b.tableau.flat(), ...b.foundations.flat(), ...b.freeCells.filter((c) => c !== null)]);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !present.has(c));
  // Park the remaining cards in column 8 under a King so they never become exposed.
  b.tableau[7] = [...rest.filter((c) => c !== parseCard('KS')), ...(present.has(parseCard('KS')) ? [] : [parseCard('KS')])];
  if (!isCompleteBoard(b)) throw new Error('bad fixture');
  return { ...createSession(1), board: b };
}

describe('auto-play to foundations', () => {
  it('moves every eligible exposed card (tableau tops and free cells) after a player move, chaining', () => {
    // After 9C moves away, AD is exposed; 2D sits in a free cell; 3D on top of column 3.
    const s = sessionWith({
      tableau: [['AD', '9C'], ['TH'], ['3D']],
      freeCells: ['2D', null, null, null],
    });
    const r = playMove(s, { from: T(0), to: T(1), count: 1 }, 1000);
    if (!r.ok) throw new Error(r.reason);
    expect(r.kind).toBe('arrange');
    expect(r.autoMoves.length).toBe(3);
    expect(r.session.board.foundations[1].map((c) => c)).toEqual(['AD', '2D', '3D'].map(parseCard));
    expect(r.session.board.freeCells[0]).toBeNull();
    expect(r.session.moveCount).toBe(4); // 1 player move + 3 automatic
    expect(isCompleteBoard(r.session.board)).toBe(true);
  });

  it('does not run before the player makes a move', () => {
    const s = sessionWith({ tableau: [['AH']] });
    expect(s.board.tableau[0]).toEqual([parseCard('AH')]); // still exposed, untouched
  });

  it('never auto-plays a card the player just took back from a foundation', () => {
    const s = sessionWith({
      tableau: [['9S'], ['5C']],
      foundations: [[], pileUpTo('D', 8), [], []],
    });
    const r = playMove(s, { from: H(1), to: T(0), count: 1 }, 1000);
    if (!r.ok) throw new Error(r.reason);
    expect(r.autoMoves).toEqual([]);
    expect(r.session.board.tableau[0].at(-1)).toBe(parseCard('8D'));
    expect(r.session.pinned).toEqual([parseCard('8D')]);
    // Later moves keep it out too.
    const r2 = playMove(r.session, { from: T(1), to: F(0), count: 1 }, 2000);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.session.board.tableau[0].at(-1)).toBe(parseCard('8D'));
    expect(nextAutoPlayMove(r2.session.board, r2.session.pinned)).toBeNull();
  });

  it('releases the pin once the player returns the card manually', () => {
    const s = sessionWith({ tableau: [['9S']], foundations: [[], pileUpTo('D', 8), [], []] });
    const out = playMove(s, { from: H(1), to: T(0), count: 1 }, 1000);
    if (!out.ok) throw new Error();
    const back = playMove(out.session, { from: T(0), to: H(1), count: 1 }, 2000);
    if (!back.ok) throw new Error();
    expect(back.session.pinned).toEqual([]);
    expect(back.session.board.foundations[1]).toHaveLength(8);
  });

  it('undoes the player move and its auto-played cards in one step', () => {
    const s = sessionWith({ tableau: [['AD', '9C'], ['TH']], freeCells: ['2D', null, null, null] });
    const r = playMove(s, { from: T(0), to: T(1), count: 1 }, 1000);
    if (!r.ok) throw new Error();
    expect(r.session.history.length).toBe(1);
    const u = undo(r.session);
    expect(u.board).toEqual(s.board);
    expect(u.moveCount).toBe(r.session.moveCount); // undo never lowers moves
  });

  it('undoing a take-back removes its pin', () => {
    const s = sessionWith({ tableau: [['9S']], foundations: [[], pileUpTo('D', 8), [], []] });
    const r = playMove(s, { from: H(1), to: T(0), count: 1 }, 1000);
    if (!r.ok) throw new Error();
    expect(undo(r.session).pinned).toEqual([]);
  });

  it('can win the game, stopping the timer exactly once', () => {
    const s: GameSession = {
      ...sessionWith({
        tableau: [['KH'], ['QS', 'KD']],
        foundations: [pileUpTo('C', 13), pileUpTo('D', 12), pileUpTo('H', 12), pileUpTo('S', 11)],
      }),
    };
    // Column 8 holds KS only here.
    const r = playMove({ ...s, timer: { startedAt: 10, stoppedAt: null } }, { from: T(1), to: F(0), count: 1 }, 5000);
    if (!r.ok) throw new Error();
    expect(r.won).toBe(true);
    expect(r.session.status).toBe('won');
    expect(r.session.timer.stoppedAt).toBe(5000);
  });

  it('persists pinned cards and still loads older saves without the field', () => {
    const store = createMemoryStore();
    const s = sessionWith({ tableau: [['9S']], foundations: [[], pileUpTo('D', 8), [], []] });
    const r = playMove(s, { from: H(1), to: T(0), count: 1 }, 1000);
    if (!r.ok) throw new Error();
    saveGame(r.session, store);
    const loaded = loadGame(store);
    expect(loaded.status === 'ok' && loaded.value.pinned).toEqual([parseCard('8D')]);

    const legacy = { ...r.session } as Partial<GameSession>;
    delete legacy.pinned;
    store.setItem('freecell.game', JSON.stringify({ version: 1, session: legacy }));
    const old = loadGame(store);
    expect(old.status === 'ok' && old.value.pinned).toEqual([]);
  });
});
