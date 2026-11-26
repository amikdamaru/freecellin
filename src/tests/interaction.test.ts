import { describe, expect, it } from 'vitest';
import { SoundEvent } from '../audio/soundEvents';
import { activateCard, activatePile, dropCards, quickMove, type InteractionState } from '../controller/interaction';
import { createSession } from '../engine/gameActions';
import type { GameSession, Location } from '../engine/gameState';
import { board, pileUpTo } from './helpers';

const T = (index: number): Location => ({ kind: 'tableau', index });
const F = (index: number): Location => ({ kind: 'freecell', index });
const H = (index: number): Location => ({ kind: 'foundation', index });

function state(b = board({ tableau: [['9S', '8H'], ['9C'], ['KD', 'AH'], ['5C', '4S']] })): InteractionState {
  const session: GameSession = { ...createSession(1), board: b };
  return { session, selection: null };
}

describe('selection', () => {
  it('plays the select sound only when a card becomes selected', () => {
    const s0 = state();
    const t1 = activateCard(s0, T(0), 1, 0); // 8H
    expect(t1.effects.sound).toBe(SoundEvent.CARD_SELECTED);
    expect(t1.state.selection).toEqual({ from: T(0), count: 1 });
    // Same card again: deselect silently.
    const t2 = activateCard(t1.state, T(0), 1, 0);
    expect(t2.effects.sound).toBeNull();
    expect(t2.state.selection).toBeNull();
  });

  it('does not select a card that cannot be moved, and does not start the timer', () => {
    const s0 = state(board({ tableau: [['9S', '8S', '7D']] })); // 9S is covered by a same-colour 8S
    const t = activateCard(s0, T(0), 0, 0);
    expect(t.state.selection).toBeNull();
    expect(t.effects.sound).toBeNull();
    expect(t.state.session.timer.startedAt).toBeNull();
    expect(t.state.session.moveCount).toBe(0);
  });

  it('allows choosing a longer run in the same column', () => {
    const t1 = activateCard(state(), T(0), 1, 0);
    const t2 = activateCard(t1.state, T(0), 0, 0);
    expect(t2.state.selection).toEqual({ from: T(0), count: 2 });
    expect(t2.effects.sound).toBe(SoundEvent.CARD_SELECTED);
  });
});

describe('one action -> one sound', () => {
  it('arrange: building onto a tableau card', () => {
    const t1 = activateCard(state(), T(0), 1, 0); // select 8H
    const t2 = activateCard(t1.state, T(1), 0, 1000); // onto 9C
    expect(t2.effects.sound).toBe(SoundEvent.CARD_ARRANGED);
    expect(t2.state.session.moveCount).toBe(1);
    expect(t2.state.session.timer.startedAt).toBe(1000);
  });

  it('move: to a free cell or empty column', () => {
    const t1 = activateCard(state(), T(1), 0, 0);
    expect(activatePile(t1.state, F(0), 0).effects.sound).toBe(SoundEvent.CARD_MOVED);
    expect(activatePile(t1.state, T(5), 0).effects.sound).toBe(SoundEvent.CARD_MOVED);
  });

  it('foundation: to a foundation pile', () => {
    const t1 = activateCard(state(), T(2), 1, 0); // AH
    const t2 = activatePile(t1.state, H(2), 0);
    expect(t2.effects.sound).toBe(SoundEvent.CARD_TO_FOUNDATION);
  });

  it('invalid: wrong colour / rank leaves the game unchanged', () => {
    const s0 = state();
    const t1 = activateCard(s0, T(3), 1, 0); // 4S
    const t2 = activateCard(t1.state, T(0), 1, 0); // onto 8H: invalid
    expect(t2.effects.sound).toBe(SoundEvent.INVALID_MOVE);
    expect(t2.state.session).toBe(s0.session);
    expect(t2.state.selection).toBeNull();
    expect(t2.effects.rejectedCards).toHaveLength(1);
  });

  it('drag and drop uses the same rules and sounds', () => {
    const s0 = state();
    expect(dropCards(s0, T(0), 1, T(1), 0).effects.sound).toBe(SoundEvent.CARD_ARRANGED);
    expect(dropCards(s0, T(0), 1, H(0), 0).effects.sound).toBe(SoundEvent.INVALID_MOVE);
    const back = dropCards(s0, T(0), 1, null, 0);
    expect(back.effects.sound).toBeNull();
    expect(back.state.session).toBe(s0.session);
  });

  it('double-click sends a card to its foundation', () => {
    const t = quickMove(state(), T(2), 1, 0);
    expect(t.effects.sound).toBe(SoundEvent.CARD_TO_FOUNDATION);
    expect(t.state.session.board.foundations[2]).toHaveLength(1);
  });
});

describe('winning', () => {
  it('reports the win exactly once and ignores input afterwards', () => {
    const b = board({
      tableau: [['KS']],
      foundations: [pileUpTo('C', 13), pileUpTo('D', 13), pileUpTo('H', 13), pileUpTo('S', 12)],
    });
    const t1 = quickMove(state(b), T(0), 0, 0);
    expect(t1.effects.won).toBe(true);
    expect(t1.state.session.status).toBe('won');
    const t2 = activateCard(t1.state, H(3), 0, 0);
    expect(t2.effects.won).toBe(false);
    expect(t2.effects.sound).toBeNull();
    expect(quickMove(t1.state, T(0), 0, 0).effects.won).toBe(false);
  });
});
