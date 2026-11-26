import type { MoveKind } from '../engine/gameActions';
import cardArrangeUrl from './sounds/card-arrange.wav';
import cardMoveUrl from './sounds/card-move.wav';
import cardSelectUrl from './sounds/card-select.wav';
import foundationUrl from './sounds/foundation.wav';
import invalidMoveUrl from './sounds/invalid-move.wav';
import winUrl from './sounds/win.wav';

/**
 * Audio events. Each maps to exactly one sound file.
 *
 * Classification of successful moves (see engine `classifyMove`):
 * - CARD_TO_FOUNDATION: the card landed on a foundation pile.
 * - CARD_ARRANGED:      card(s) were built onto a tableau card in descending,
 *                       alternating-colour order (e.g. 8♥ onto 9♠).
 * - CARD_MOVED:         card(s) went to a free cell or an empty tableau column
 *                       (relocation without building a sequence).
 */
export const SoundEvent = {
  CARD_SELECTED: 'CARD_SELECTED',
  CARD_ARRANGED: 'CARD_ARRANGED',
  CARD_MOVED: 'CARD_MOVED',
  CARD_TO_FOUNDATION: 'CARD_TO_FOUNDATION',
  INVALID_MOVE: 'INVALID_MOVE',
  GAME_WON: 'GAME_WON',
} as const;

export type SoundEvent = (typeof SoundEvent)[keyof typeof SoundEvent];

export const SOUND_SOURCES: Record<SoundEvent, string> = {
  CARD_SELECTED: cardSelectUrl,
  CARD_ARRANGED: cardArrangeUrl,
  CARD_MOVED: cardMoveUrl,
  CARD_TO_FOUNDATION: foundationUrl,
  INVALID_MOVE: invalidMoveUrl,
  GAME_WON: winUrl,
};

/** One move -> exactly one primary sound category. */
export function soundForMove(kind: MoveKind): SoundEvent {
  switch (kind) {
    case 'foundation':
      return SoundEvent.CARD_TO_FOUNDATION;
    case 'arrange':
      return SoundEvent.CARD_ARRANGED;
    case 'move':
      return SoundEvent.CARD_MOVED;
  }
}
