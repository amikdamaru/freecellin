/**
 * Local Storage persistence with versioning and validation.
 *
 * Keys:
 *   freecell.game  -> { version, savedAt, session }
 *   freecell.wins  -> { version, wins }
 *
 * Every read is validated; corrupt or unknown data never crashes the app and
 * is reported back so the UI can start a fresh game and tell the player.
 */
import { isValidCard } from '../engine/card';
import { isValidDealNumber } from '../engine/dealGenerator';
import { MAX_HISTORY } from '../engine/gameActions';
import {
  FOUNDATION_COUNT,
  FREE_CELL_COUNT,
  isCompleteBoard,
  TABLEAU_COUNT,
  type Board,
  type GameSession,
} from '../engine/gameState';
import { isWon } from '../engine/winCondition';

export const STORAGE_VERSION = 1;
export const GAME_KEY = 'freecell.game';
export const WINS_KEY = 'freecell.wins';

export type LoadResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'empty' }
  | { status: 'invalid'; error: string };

/** Minimal Storage interface so tests can inject an in-memory store. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Access can throw (privacy mode, sandboxed iframes).
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isTimestampOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
}

export function parseBoard(v: unknown): Board | null {
  if (!isObject(v)) return null;
  const { freeCells, foundations, tableau } = v;
  if (!Array.isArray(freeCells) || freeCells.length !== FREE_CELL_COUNT) return null;
  if (!freeCells.every((c) => c === null || isValidCard(c))) return null;
  if (!Array.isArray(foundations) || foundations.length !== FOUNDATION_COUNT) return null;
  if (!foundations.every((p) => Array.isArray(p) && p.every(isValidCard))) return null;
  if (!Array.isArray(tableau) || tableau.length !== TABLEAU_COUNT) return null;
  if (!tableau.every((c) => Array.isArray(c) && c.every(isValidCard))) return null;
  const board: Board = {
    freeCells: freeCells as Board['freeCells'],
    foundations: foundations as Board['foundations'],
    tableau: tableau as Board['tableau'],
  };
  return isCompleteBoard(board) ? board : null;
}

export function parseSession(v: unknown): GameSession | null {
  if (!isObject(v)) return null;
  const { dealNumber, board, history, moveCount, status, timer } = v;
  if (!isValidDealNumber(dealNumber)) return null;
  const parsedBoard = parseBoard(board);
  if (!parsedBoard) return null;
  if (!Array.isArray(history) || history.length > MAX_HISTORY) return null;
  const parsedHistory: Board[] = [];
  for (const h of history) {
    const b = parseBoard(h);
    if (!b) return null;
    parsedHistory.push(b);
  }
  if (typeof moveCount !== 'number' || !Number.isInteger(moveCount) || moveCount < 0) return null;
  if (status !== 'playing' && status !== 'won') return null;
  if ((status === 'won') !== isWon(parsedBoard)) return null;
  if (!isObject(timer) || !isTimestampOrNull(timer.startedAt) || !isTimestampOrNull(timer.stoppedAt)) return null;
  if (timer.startedAt === null && timer.stoppedAt !== null) return null;
  return {
    dealNumber,
    board: parsedBoard,
    history: parsedHistory,
    moveCount,
    status,
    timer: { startedAt: timer.startedAt, stoppedAt: status === 'won' ? (timer.stoppedAt ?? timer.startedAt) : null },
  };
}

function readJson(store: KeyValueStore, key: string): LoadResult<unknown> {
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch (e) {
    return { status: 'invalid', error: `Cannot read ${key}: ${String(e)}` };
  }
  if (raw === null) return { status: 'empty' };
  try {
    return { status: 'ok', value: JSON.parse(raw) };
  } catch {
    return { status: 'invalid', error: `${key} is not valid JSON` };
  }
}

function writeJson(store: KeyValueStore | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // Quota exceeded or storage disabled; the game keeps running.
  }
}

/**
 * Migrate older payload versions here as the format evolves.
 * Currently only version 1 exists.
 */
function migrateGame(payload: Record<string, unknown>): Record<string, unknown> | null {
  if (payload.version === STORAGE_VERSION) return payload;
  return null;
}

export function loadGame(store: KeyValueStore | null = defaultStore()): LoadResult<GameSession> {
  if (!store) return { status: 'empty' };
  const res = readJson(store, GAME_KEY);
  if (res.status !== 'ok') return res;
  if (!isObject(res.value)) return { status: 'invalid', error: 'Saved game has an unexpected format' };
  const migrated = migrateGame(res.value);
  if (!migrated) return { status: 'invalid', error: `Unsupported save version: ${String(res.value.version)}` };
  const session = parseSession(migrated.session);
  return session ? { status: 'ok', value: session } : { status: 'invalid', error: 'Saved game data is corrupted' };
}

export function saveGame(session: GameSession, store: KeyValueStore | null = defaultStore()): boolean {
  return writeJson(store, GAME_KEY, { version: STORAGE_VERSION, savedAt: Date.now(), session });
}

export function clearGame(store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.removeItem(GAME_KEY);
  } catch {
    /* ignore */
  }
}

export function loadWins(store: KeyValueStore | null = defaultStore()): LoadResult<number> {
  if (!store) return { status: 'empty' };
  const res = readJson(store, WINS_KEY);
  if (res.status !== 'ok') return res;
  const v = res.value;
  if (isObject(v) && v.version === STORAGE_VERSION && typeof v.wins === 'number' && Number.isInteger(v.wins) && v.wins >= 0) {
    return { status: 'ok', value: v.wins };
  }
  return { status: 'invalid', error: 'Win counter data is corrupted' };
}

export function saveWins(wins: number, store: KeyValueStore | null = defaultStore()): boolean {
  return writeJson(store, WINS_KEY, { version: STORAGE_VERSION, wins });
}

/** In-memory store, used by tests and as a fallback. */
export function createMemoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}
