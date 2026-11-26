import { useEffect, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { GameBoard } from './components/GameBoard';
import { GameControls } from './components/GameControls';
import { GameHeader } from './components/GameHeader';
import { StatisticsBar } from './components/StatisticsBar';
import { WinModal } from './components/WinModal';
import { useGame } from './hooks/useGame';

type Pending = 'retry' | 'new' | null;

export default function App() {
  const game = useGame();
  const { session } = game;
  const [confirm, setConfirm] = useState<Pending>(null);
  const [showWin, setShowWin] = useState(session.status === 'won');

  // Let the last card land before the win screen appears.
  useEffect(() => {
    if (session.status !== 'won') {
      setShowWin(false);
      return;
    }
    const id = window.setTimeout(() => setShowWin(true), 650);
    return () => window.clearTimeout(id);
  }, [session.status]);

  // Audio may only start after a user gesture (autoplay policy).
  useEffect(() => {
    const unlock = () => game.unlockAudio();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirm) return;
      if (e.key === 'Escape') game.clearSelection();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        game.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, confirm]);

  const requestNewGame = () => {
    if (session.status === 'playing' && session.moveCount > 0) setConfirm('new');
    else game.newGame();
  };

  return (
    <div className="app">
      <GameHeader wins={game.wins} />
      <StatisticsBar moves={session.moveCount} timer={session.timer} dealNumber={session.dealNumber} />
      <main className="main">
        <GameBoard game={game} />
      </main>
      <GameControls
        canUndo={game.canUndo}
        canAutoComplete={game.canAutoComplete}
        onUndo={game.undo}
        onRetry={() => setConfirm('retry')}
        onNewGame={requestNewGame}
        onAutoComplete={game.autoComplete}
      />

      {game.notice && (
        <div className="toast" role="alert">
          <span>{game.notice}</span>
          <button type="button" className="toast__close" onClick={game.dismissNotice} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {confirm === 'retry' && (
        <ConfirmDialog
          title="Retry this deal?"
          message="The cards return to their starting positions. Moves and time are reset."
          confirmLabel="Retry"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            game.retry();
          }}
        />
      )}
      {confirm === 'new' && (
        <ConfirmDialog
          title="Start a new game?"
          message="Your current game is not finished. Its progress will be lost."
          confirmLabel="New Game"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            game.newGame();
          }}
        />
      )}
      {showWin && session.status === 'won' && (
        <WinModal moves={session.moveCount} timer={session.timer} dealNumber={session.dealNumber} onNewGame={() => game.newGame()} />
      )}
    </div>
  );
}
