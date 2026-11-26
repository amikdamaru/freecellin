import { describe, expect, it } from 'vitest';
import { createSession, performMove, retry, undo } from '../engine/gameActions';
import { formatElapsed, getElapsedMs } from '../engine/gameState';
import { createMemoryStore, loadGame, saveGame } from '../services/storage';

const T0 = { kind: 'tableau', index: 0 } as const;
const F0 = { kind: 'freecell', index: 0 } as const;

describe('timer', () => {
  it('formats MM:SS without an upper limit', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(59_999)).toBe('00:59');
    expect(formatElapsed(61_000)).toBe('01:01');
    expect(formatElapsed(100 * 60_000 + 5_000)).toBe('100:05');
  });

  it('does not run before the first valid move', () => {
    const s = createSession(1);
    expect(getElapsedMs(s.timer, 999_999)).toBe(0);
  });

  it('is derived from timestamps (correct after background / sleep gaps)', () => {
    const r = performMove(createSession(1), { from: T0, to: F0, count: 1 }, 10_000);
    if (!r.ok) throw new Error();
    // e.g. the device slept for an hour: no ticks happened, value is still exact.
    expect(getElapsedMs(r.session.timer, 10_000 + 3_600_000)).toBe(3_600_000);
  });

  it('is not rewound by undo', () => {
    const r = performMove(createSession(1), { from: T0, to: F0, count: 1 }, 10_000);
    if (!r.ok) throw new Error();
    const u = undo(r.session);
    expect(u.timer).toEqual(r.session.timer);
    expect(getElapsedMs(u.timer, 25_000)).toBe(15_000);
  });

  it('is reset to 00:00 and stopped by retry', () => {
    const r = performMove(createSession(1), { from: T0, to: F0, count: 1 }, 10_000);
    if (!r.ok) throw new Error();
    const again = retry(r.session);
    expect(getElapsedMs(again.timer, 50_000)).toBe(0);
    expect(again.timer.startedAt).toBeNull();
  });

  it('stays accurate across a save / browser restart', () => {
    const store = createMemoryStore();
    const r = performMove(createSession(1), { from: T0, to: F0, count: 1 }, 10_000);
    if (!r.ok) throw new Error();
    saveGame(r.session, store);
    const loaded = loadGame(store);
    if (loaded.status !== 'ok') throw new Error();
    expect(getElapsedMs(loaded.value.timer, 70_000)).toBe(60_000);
  });

  it('is frozen once the game is won', () => {
    const timer = { startedAt: 1_000, stoppedAt: 91_000 };
    expect(getElapsedMs(timer, 5_000_000)).toBe(90_000);
  });
});
