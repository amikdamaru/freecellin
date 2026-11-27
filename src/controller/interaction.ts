/**
 * Pure interaction controller: turns player input (select, tap a destination,
 * drop, double-click) into a new state plus *explicit* side effects
 * (at most one sound, win flag, invalid-move feedback).
 *
 * Keeping this outside React makes the "one action -> one sound" rule testable
 * and guarantees sounds never come from re-renders.
 */
import { SoundEvent, soundForMove } from '../audio/soundEvents';
import { findQuickMove, playMove } from '../engine/gameActions';
import { sameLocation, type GameSession, type Location, type Move } from '../engine/gameState';
import { canPickUp, cardsAt } from '../engine/moveValidator';

export interface Selection {
  from: Location;
  count: number;
}

export interface InteractionState {
  session: GameSession;
  selection: Selection | null;
}

export interface Effects {
  /** The sound of the player's own action (at most one). */
  sound: SoundEvent | null;
  /** Cards auto-played to the foundations right after the player's move. */
  autoPlayed: number;
  /** True exactly once: on the move that wins the game. */
  won: boolean;
  /** Cards to flash as an invalid attempt (or a non-selectable tap). */
  rejectedCards: number[] | null;
}

export interface Transition {
  state: InteractionState;
  effects: Effects;
}

const NO_EFFECTS: Effects = { sound: null, autoPlayed: 0, won: false, rejectedCards: null };

function noChange(state: InteractionState, effects: Partial<Effects> = {}): Transition {
  return { state, effects: { ...NO_EFFECTS, ...effects } };
}

/** Number of cards picked up when the card at `cardIndex` of `loc` is grabbed. */
export function countFromIndex(session: GameSession, loc: Location, cardIndex: number): number {
  if (loc.kind === 'tableau') return session.board.tableau[loc.index].length - cardIndex;
  return 1;
}

export function canSelect(session: GameSession, loc: Location, count: number): boolean {
  return session.status === 'playing' && count >= 1 && canPickUp(session.board, loc, count);
}

/**
 * Attempt a move (plus auto-play to the foundations). The player's move plays
 * exactly one move-category sound; failure plays the invalid sound only.
 */
export function attemptMove(state: InteractionState, move: Move, now: number): Transition {
  const outcome = playMove(state.session, move, now);
  if (!outcome.ok) {
    if (outcome.reason === 'game-over') return noChange({ ...state, selection: null });
    return noChange(
      { ...state, selection: null },
      { sound: SoundEvent.INVALID_MOVE, rejectedCards: cardsAt(state.session.board, move.from, move.count) },
    );
  }
  return {
    state: { session: outcome.session, selection: null },
    effects: {
      sound: soundForMove(outcome.kind),
      autoPlayed: outcome.autoMoves.length,
      won: outcome.won,
      rejectedCards: null,
    },
  };
}

/**
 * The player clicked/tapped a card (tableau card at `cardIndex`, or a free cell / foundation card).
 * - No selection: select it if it may be picked up (select sound), otherwise flash it.
 * - Same card again: deselect (silent).
 * - Another card of the same column: change the selection to that run if valid.
 * - Anything else: treat its pile as the destination of the selected cards.
 */
export function activateCard(state: InteractionState, loc: Location, cardIndex: number, now: number): Transition {
  const { session, selection } = state;
  if (session.status !== 'playing') return noChange(state);
  const count = countFromIndex(session, loc, cardIndex);

  if (selection) {
    if (sameLocation(selection.from, loc)) {
      if (selection.count === count || !canSelect(session, loc, count)) {
        return noChange({ ...state, selection: null });
      }
      return noChange({ ...state, selection: { from: loc, count } }, { sound: SoundEvent.CARD_SELECTED });
    }
    return attemptMove(state, { ...selection, to: loc }, now);
  }

  if (canSelect(session, loc, count)) {
    return noChange({ ...state, selection: { from: loc, count } }, { sound: SoundEvent.CARD_SELECTED });
  }
  return noChange(state, { rejectedCards: cardsAt(session.board, loc, Math.max(1, count)) });
}

/** The player tapped an empty slot or pile area (no card). */
export function activatePile(state: InteractionState, loc: Location, now: number): Transition {
  if (state.session.status !== 'playing' || !state.selection) return noChange(state);
  if (sameLocation(state.selection.from, loc)) return noChange({ ...state, selection: null });
  return attemptMove(state, { ...state.selection, to: loc }, now);
}

/** Drag-and-drop finished over a destination (or nowhere, if `to` is null). */
export function dropCards(state: InteractionState, from: Location, count: number, to: Location | null, now: number): Transition {
  if (to === null || sameLocation(from, to)) return noChange({ ...state, selection: null });
  return attemptMove({ ...state, selection: null }, { from, to, count }, now);
}

/**
 * Double-click / double-tap: send the cards to the best legal destination.
 * Not available on foundations: taking a card back must be a deliberate
 * select-and-place or drag, never an accidental double-click.
 */
export function quickMove(state: InteractionState, loc: Location, cardIndex: number, now: number): Transition {
  const { session } = state;
  if (session.status !== 'playing' || loc.kind === 'foundation') return noChange(state);
  const count = countFromIndex(session, loc, cardIndex);
  if (!canSelect(session, loc, count)) {
    return noChange({ ...state, selection: null }, { rejectedCards: cardsAt(session.board, loc, count) });
  }
  const move = findQuickMove(session.board, loc, count);
  if (!move) {
    return noChange(
      { ...state, selection: null },
      { sound: SoundEvent.INVALID_MOVE, rejectedCards: cardsAt(session.board, loc, count) },
    );
  }
  return attemptMove({ ...state, selection: null }, move, now);
}
