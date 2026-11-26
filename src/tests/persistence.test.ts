import { describe, expect, it } from 'vitest';
import { createSession, performMove, retry } from '../engine/gameActions';
import { pickRandomDeal } from '../engine/dealGenerator';
import {
  createMemoryStore,
  GAME_KEY,
  loadGame,
  loadWins,
  saveGame,
  saveWins,
  WINS_KEY,
} from '../services/storage';

function playedSession() {
  let s = createSession(617);
  const r1 = performMove(s, { from: { kind: 'tableau', index: 0 }, to: { kind: 'freecell', index: 0 }, count: 1 }, 1_000);
  if (!r1.ok) throw new Error('setup');
  s = r1.session;
  return s;
}

describe('game persistence', () => {
  it('round-trips the full session (board, history, moves, timer, deal)', () => {
    const store = createMemoryStore();
    const s = playedSession();
    expect(saveGame(s, store)).toBe(true);
    const loaded = loadGame(store);
    expect(loaded).toEqual({ status: 'ok', value: s });
  });

  it('stores a versioned payload', () => {
    const store = createMemoryStore();
    saveGame(playedSession(), store);
    const raw = JSON.parse(store.data.get(GAME_KEY)!);
    expect(raw.version).toBe(1);
  });

  it('reports empty storage', () => {
    expect(loadGame(createMemoryStore())).toEqual({ status: 'empty' });
  });

  it.each([
    ['not json', '{oops'],
    ['wrong version', JSON.stringify({ version: 99, session: {} })],
    ['missing session', JSON.stringify({ version: 1 })],
    ['array', '[]'],
  ])('rejects corrupted data safely (%s)', (_, raw) => {
    const store = createMemoryStore();
    store.setItem(GAME_KEY, raw);
    const res = loadGame(store);
    expect(res.status).toBe('invalid');
  });

  it('rejects boards with duplicated or missing cards', () => {
    const store = createMemoryStore();
    const s = playedSession();
    const broken = structuredClone(s);
    broken.board.tableau[1][0] = broken.board.tableau[2][0]; // duplicate card
    saveGame(broken, store);
    expect(loadGame(store).status).toBe('invalid');

    const brokenHistory = structuredClone(s);
    brokenHistory.history[0].tableau[0].pop(); // missing card in an undo snapshot
    saveGame(brokenHistory, store);
    expect(loadGame(store).status).toBe('invalid');
  });

  it('rejects a "won" status on a board that is not finished', () => {
    const store = createMemoryStore();
    saveGame({ ...playedSession(), status: 'won' }, store);
    expect(loadGame(store).status).toBe('invalid');
  });

  it('never throws when storage itself throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(loadGame(throwing).status).toBe('invalid');
    expect(saveGame(createSession(1), throwing)).toBe(false);
  });

  it('retry keeps the deal number; a new game picks a different one', () => {
    const s = playedSession();
    expect(retry(s).dealNumber).toBe(617);
    expect(pickRandomDeal(617)).not.toBe(617);
  });
});

describe('win counter persistence', () => {
  it('round-trips and survives a "restart"', () => {
    const store = createMemoryStore();
    expect(loadWins(store)).toEqual({ status: 'empty' });
    saveWins(3, store);
    expect(loadWins(store)).toEqual({ status: 'ok', value: 3 });
  });

  it('rejects corrupted counters', () => {
    const store = createMemoryStore();
    store.setItem(WINS_KEY, JSON.stringify({ version: 1, wins: -2 }));
    expect(loadWins(store).status).toBe('invalid');
    store.setItem(WINS_KEY, 'NaN');
    expect(loadWins(store).status).toBe('invalid');
  });
});
