import { generateDeal } from './dealGenerator';
import { cloneBoard, type Board, type GameSession, type Location, type Move } from './gameState';
import { validateMove, validDestinations, type InvalidReason } from './moveValidator';
import { isWon } from './winCondition';

/** Upper bound on stored undo snapshots (keeps Local Storage small). */
export const MAX_HISTORY = 1000;

/**
 * How a successful move is classified (drives the sound effect):
 * - 'foundation': the card went to a foundation pile.
 * - 'arrange':    the card(s) were built onto a tableau card (descending, alternating colours).
 * - 'move':       the card(s) went to a free cell or an empty tableau column.
 */
export type MoveKind = 'foundation' | 'arrange' | 'move';

export type MoveOutcome =
  | { ok: true; session: GameSession; kind: MoveKind; won: boolean }
  | { ok: false; reason: InvalidReason | 'game-over' };

export function createSession(dealNumber: number): GameSession {
  return {
    dealNumber,
    board: generateDeal(dealNumber),
    history: [],
    moveCount: 0,
    status: 'playing',
    timer: { startedAt: null, stoppedAt: null },
  };
}

export function classifyMove(board: Board, move: Move): MoveKind {
  if (move.to.kind === 'foundation') return 'foundation';
  if (move.to.kind === 'tableau' && board.tableau[move.to.index].length > 0) return 'arrange';
  return 'move';
}

/** Apply a move that has already been validated. Returns a new board. */
export function applyMoveToBoard(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  let cards: number[];
  if (move.from.kind === 'tableau') {
    const col = next.tableau[move.from.index];
    cards = col.splice(col.length - move.count, move.count);
  } else if (move.from.kind === 'freecell') {
    cards = [next.freeCells[move.from.index] as number];
    next.freeCells[move.from.index] = null;
  } else {
    cards = [next.foundations[move.from.index].pop() as number];
  }
  if (move.to.kind === 'tableau') next.tableau[move.to.index].push(...cards);
  else if (move.to.kind === 'freecell') next.freeCells[move.to.index] = cards[0];
  else next.foundations[move.to.index].push(cards[0]);
  return next;
}

/**
 * Validate and perform a move. Counts as exactly one move, starts the timer on
 * the first valid move and stops it on a win. Invalid moves change nothing.
 */
export function performMove(session: GameSession, move: Move, now: number): MoveOutcome {
  if (session.status !== 'playing') return { ok: false, reason: 'game-over' };
  const check = validateMove(session.board, move);
  if (!check.ok) return check;

  const kind = classifyMove(session.board, move);
  const board = applyMoveToBoard(session.board, move);
  const won = isWon(board);
  const history = [...session.history, session.board];
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  const startedAt = session.timer.startedAt ?? now;

  return {
    ok: true,
    kind,
    won,
    session: {
      ...session,
      board,
      history,
      moveCount: session.moveCount + 1,
      status: won ? 'won' : 'playing',
      timer: { startedAt, stoppedAt: won ? now : null },
    },
  };
}

export function canUndo(session: GameSession): boolean {
  return session.status === 'playing' && session.history.length > 0;
}

/** Restore the board before the last move. Move count and timer are untouched. */
export function undo(session: GameSession): GameSession {
  if (!canUndo(session)) return session;
  const history = session.history.slice(0, -1);
  return { ...session, board: session.history[session.history.length - 1], history };
}

/** Restart the same deal from its initial layout. */
export function retry(session: GameSession): GameSession {
  return createSession(session.dealNumber);
}

/** Best destination for a "quick move" (double-click / double-tap), or null. */
export function findQuickMove(board: Board, from: Location, count: number): Move | null {
  const dests = validDestinations(board, from, count);
  const rank = (to: Location): number => {
    if (to.kind === 'foundation') return 0;
    if (to.kind === 'tableau') return board.tableau[to.index].length > 0 ? 1 : 2;
    return from.kind === 'freecell' ? 99 : 3; // never shuffle between free cells
  };
  const best = dests.filter((d) => rank(d) < 99).sort((a, b) => rank(a) - rank(b))[0];
  return best ? { from, to: best, count } : null;
}
