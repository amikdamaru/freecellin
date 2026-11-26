import { useEffect, useRef } from 'react';
import { createSession } from '../engine/gameActions';
import { isValidDealNumber, pickRandomDeal } from '../engine/dealGenerator';
import type { GameSession } from '../engine/gameState';
import { loadGame, loadWins, saveGame } from '../services/storage';

export interface InitialState {
  session: GameSession;
  wins: number;
  notice: string | null;
}

/** Deal requested through `?deal=N` (debugging / sharing), or null. */
export function dealFromUrl(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('deal');
    const n = raw === null ? NaN : Number(raw);
    return isValidDealNumber(n) ? n : null;
  } catch {
    return null;
  }
}

function stripDealParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('deal')) return;
    url.searchParams.delete('deal');
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* ignore */
  }
}

let initialCache: InitialState | null = null;

/**
 * Restore the saved game (silently, no sounds) or start a new one.
 * Cached so React StrictMode's double initialisation reads the URL/storage once.
 */
export function loadInitialState(): InitialState {
  initialCache ??= readInitialState();
  return initialCache;
}

function readInitialState(): InitialState {
  const notices: string[] = [];
  const winsRes = loadWins();
  const wins = winsRes.status === 'ok' ? winsRes.value : 0;
  if (winsRes.status === 'invalid') notices.push('The saved win counter was unreadable and has been reset.');

  const requested = dealFromUrl();
  stripDealParam();
  const gameRes = loadGame();
  let session: GameSession;
  if (requested !== null && !(gameRes.status === 'ok' && gameRes.value.dealNumber === requested)) {
    session = createSession(requested);
  } else if (gameRes.status === 'ok') {
    session = gameRes.value;
  } else {
    if (gameRes.status === 'invalid') notices.push('Your saved game could not be restored, so a new game was started.');
    session = createSession(pickRandomDeal(null));
  }
  return { session, wins, notice: notices.length ? notices.join(' ') : null };
}

/** Save the session whenever it changes, and once more when the page is hidden. */
export function usePersistence(session: GameSession): void {
  const latest = useRef(session);
  latest.current = session;

  useEffect(() => {
    saveGame(session);
  }, [session]);

  useEffect(() => {
    const flush = () => saveGame(latest.current);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);
}
