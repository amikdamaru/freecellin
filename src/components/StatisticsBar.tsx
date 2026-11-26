import { formatElapsed, type TimerState } from '../engine/gameState';
import { useTimer } from '../hooks/useTimer';
import { ClockIcon, MovesIcon } from './icons';

/** Only this component re-renders on timer ticks; the board does not. */
function TimerValue({ timer }: { timer: TimerState }) {
  const elapsed = useTimer(timer);
  return <span className="stat__value stat__value--mono">{formatElapsed(elapsed)}</span>;
}

export function StatisticsBar({ moves, timer, dealNumber }: { moves: number; timer: TimerState; dealNumber: number }) {
  return (
    <div className="stats" role="status" aria-live="off">
      <div className="stat">
        <MovesIcon className="stat__icon" />
        <span className="stat__label">Moves</span>
        <span className="stat__value">{moves}</span>
      </div>
      <div className="stat">
        <ClockIcon className="stat__icon" />
        <span className="stat__label">Time</span>
        <TimerValue timer={timer} />
      </div>
      <span className="stats__deal" title="Microsoft deal number">
        #{dealNumber}
      </span>
    </div>
  );
}
