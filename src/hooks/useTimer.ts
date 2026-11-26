import { useEffect, useState } from 'react';
import { getElapsedMs, type TimerState } from '../engine/gameState';

/**
 * Elapsed time derived from timestamps. The interval only schedules re-renders;
 * it never accumulates time, so the value stays exact across background tabs,
 * device sleep and app restarts.
 */
export function useTimer(timer: TimerState): number {
  const running = timer.startedAt !== null && timer.stoppedAt === null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [running, timer.startedAt]);

  return getElapsedMs(timer, now);
}
