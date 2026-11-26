import type { ReactNode } from 'react';
import { AutoIcon, NewGameIcon, RetryIcon, UndoIcon } from './icons';

interface Props {
  canUndo: boolean;
  canAutoComplete: boolean;
  onUndo: () => void;
  onRetry: () => void;
  onNewGame: () => void;
  onAutoComplete: () => void;
}

function ControlButton({ label, icon, onClick, disabled, accent }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <button type="button" className={`control${accent ? ' control--accent' : ''}`} onClick={onClick} disabled={disabled} title={label}>
      {icon}
      <span className="control__label">{label}</span>
    </button>
  );
}

export function GameControls({ canUndo, canAutoComplete, onUndo, onRetry, onNewGame, onAutoComplete }: Props) {
  return (
    <nav className="controls" aria-label="Game controls">
      <ControlButton label="Undo" icon={<UndoIcon className="control__icon" />} onClick={onUndo} disabled={!canUndo} />
      <ControlButton label="Retry" icon={<RetryIcon className="control__icon" />} onClick={onRetry} />
      <ControlButton label="New Game" icon={<NewGameIcon className="control__icon" />} onClick={onNewGame} />
      <ControlButton
        label="Auto"
        icon={<AutoIcon className="control__icon" />}
        onClick={onAutoComplete}
        disabled={!canAutoComplete}
        accent={canAutoComplete}
      />
    </nav>
  );
}
