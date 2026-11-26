import { useEffect, useRef } from 'react';
import { SUITS } from '../engine/card';
import { formatElapsed, getElapsedMs, type TimerState } from '../engine/gameState';
import { CrownIcon, SuitIcon } from './icons';

interface Props {
  moves: number;
  timer: TimerState;
  dealNumber: number;
  onNewGame: () => void;
}

export function WinModal({ moves, timer, dealNumber, onNewGame }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => buttonRef.current?.focus(), []);
  // The timer is stopped on a win, so this value is final.
  const time = formatElapsed(getElapsedMs(timer, timer.stoppedAt ?? Date.now()));

  return (
    <div className="overlay overlay--win">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={`confetti__bit confetti__bit--${i % 4 < 2 ? 'red' : 'black'}`} style={{ left: `${(i * 6.1 + 3) % 100}%`, animationDelay: `${(i % 8) * 0.18}s` }}>
            <SuitIcon suit={SUITS[i % 4]} />
          </span>
        ))}
      </div>
      <div className="dialog dialog--win" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <CrownIcon className="win__crown" />
        <h2 id="win-title" className="dialog__title">You won!</h2>
        <p className="win__deal">Deal #{dealNumber}</p>
        <dl className="win__stats">
          <div>
            <dt>Time</dt>
            <dd>{time}</dd>
          </div>
          <div>
            <dt>Moves</dt>
            <dd>{moves}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn--primary btn--wide" ref={buttonRef} onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  );
}
