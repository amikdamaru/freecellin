import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../audio/audioManager';
import { getMusicManager } from '../audio/musicManager';
import { SoundEvent } from '../audio/soundEvents';
import {
  activateCard,
  activatePile,
  attemptMove,
  dropCards,
  quickMove,
  type InteractionState,
  type Selection,
  type Transition,
} from '../controller/interaction';
import { canAutoComplete, nextFoundationMove } from '../engine/autoComplete';
import { pickRandomDeal } from '../engine/dealGenerator';
import { canUndo, createSession, retry as retrySession, undo as undoSession } from '../engine/gameActions';
import type { GameSession, Location } from '../engine/gameState';
import { saveWins } from '../services/storage';
import { loadInitialState, usePersistence } from './usePersistence';

/** Why the board last changed; the UI animates only real card moves. */
export type ChangeKind = 'initial' | 'move' | 'undo' | 'reset';

export interface Rejection {
  cards: number[];
  nonce: number;
}

const AUTO_STEP_MS = 140;

export function useGame() {
  const [initial] = useState(loadInitialState);
  const [state, setState] = useState<InteractionState>({ session: initial.session, selection: null });
  const [wins, setWins] = useState(initial.wins);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [changeKind, setChangeKind] = useState<ChangeKind>('initial');

  // The ref is the source of truth for event handlers (avoids stale closures
  // and makes rapid repeated events act on the latest state).
  const stateRef = useRef(state);
  const winsRef = useRef(wins);
  const autoTimer = useRef<number | null>(null);
  const audio = getAudioManager();

  usePersistence(state.session);

  const commit = useCallback((next: InteractionState, kind?: ChangeKind) => {
    stateRef.current = next;
    setState(next);
    if (kind) setChangeKind(kind);
  }, []);

  const stopAutoComplete = useCallback(() => {
    if (autoTimer.current !== null) window.clearTimeout(autoTimer.current);
    autoTimer.current = null;
    setAutoCompleting(false);
  }, []);

  /** Apply a controller transition and run its side effects exactly once. */
  const apply = useCallback(
    (t: Transition) => {
      const prev = stateRef.current;
      const moved = t.state.session !== prev.session;
      if (moved || t.state.selection !== prev.selection) commit(t.state, moved ? 'move' : undefined);
      if (t.effects.sound) audio.play(t.effects.sound);
      if (t.effects.rejectedCards?.length) {
        setRejection({ cards: t.effects.rejectedCards, nonce: Date.now() + Math.random() });
      }
      if (t.effects.won) {
        const total = winsRef.current + 1;
        winsRef.current = total;
        setWins(total);
        saveWins(total);
        stopAutoComplete();
        window.setTimeout(() => audio.play(SoundEvent.GAME_WON), 380);
      }
    },
    [audio, commit, stopAutoComplete],
  );

  const busy = () => autoTimer.current !== null;

  const onCard = useCallback(
    (loc: Location, cardIndex: number) => {
      if (!busy()) apply(activateCard(stateRef.current, loc, cardIndex, Date.now()));
    },
    [apply],
  );

  const onPile = useCallback(
    (loc: Location) => {
      if (!busy()) apply(activatePile(stateRef.current, loc, Date.now()));
    },
    [apply],
  );

  const onDrop = useCallback(
    (from: Location, count: number, to: Location | null) => {
      if (!busy()) apply(dropCards(stateRef.current, from, count, to, Date.now()));
    },
    [apply],
  );

  const onQuickMove = useCallback(
    (loc: Location, cardIndex: number) => {
      if (!busy()) apply(quickMove(stateRef.current, loc, cardIndex, Date.now()));
    },
    [apply],
  );

  const clearSelection = useCallback(() => {
    if (stateRef.current.selection) commit({ ...stateRef.current, selection: null });
  }, [commit]);

  const setSelection = useCallback(
    (selection: Selection | null) => commit({ ...stateRef.current, selection }),
    [commit],
  );

  // Undo / Retry / New Game intentionally play no card sounds.
  const undo = useCallback(() => {
    if (busy() || !canUndo(stateRef.current.session)) return;
    commit({ session: undoSession(stateRef.current.session), selection: null }, 'undo');
  }, [commit]);

  const reset = useCallback(
    (session: GameSession) => {
      stopAutoComplete();
      commit({ session, selection: null }, 'reset');
    },
    [commit, stopAutoComplete],
  );

  const retry = useCallback(() => reset(retrySession(stateRef.current.session)), [reset]);

  const newGame = useCallback(
    (dealNumber?: number) => reset(createSession(dealNumber ?? pickRandomDeal(stateRef.current.session.dealNumber))),
    [reset],
  );

  const autoComplete = useCallback(() => {
    if (busy() || !canAutoComplete(stateRef.current.session.board)) return;
    commit({ ...stateRef.current, selection: null });
    setAutoCompleting(true);
    const step = () => {
      const current = stateRef.current;
      const move = current.session.status === 'playing' ? nextFoundationMove(current.session.board) : null;
      if (!move) {
        stopAutoComplete();
        return;
      }
      apply(attemptMove(current, move, Date.now()));
      if (stateRef.current.session.status === 'playing') autoTimer.current = window.setTimeout(step, AUTO_STEP_MS);
      else stopAutoComplete();
    };
    autoTimer.current = window.setTimeout(step, 0);
  }, [apply, commit, stopAutoComplete]);

  useEffect(() => () => stopAutoComplete(), [stopAutoComplete]);

  // Expose the deal number for debugging/testing (not part of the main UI).
  useEffect(() => {
    (window as unknown as { freecell?: unknown }).freecell = {
      get dealNumber() {
        return stateRef.current.session.dealNumber;
      },
      get session() {
        return stateRef.current.session;
      },
      newGame: (n?: number) => newGame(n),
    };
  }, [newGame]);

  const { session, selection } = state;
  return {
    session,
    selection,
    wins,
    notice,
    dismissNotice: () => setNotice(null),
    rejection,
    changeKind,
    autoCompleting,
    canUndo: canUndo(session) && !autoCompleting,
    canAutoComplete: session.status === 'playing' && !autoCompleting && canAutoComplete(session.board),
    onCard,
    onPile,
    onDrop,
    onQuickMove,
    clearSelection,
    setSelection,
    undo,
    retry,
    newGame,
    autoComplete,
    unlockAudio: () => {
      audio.unlock();
      getMusicManager().start();
    },
  };
}

export type GameApi = ReturnType<typeof useGame>;
