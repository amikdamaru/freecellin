import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { CrownIcon, InstallIcon } from './icons';

export function GameHeader({ wins }: { wins: number }) {
  const install = useInstallPrompt();
  return (
    <header className="header">
      <h1 className="header__title">Freecellin</h1>
      <div className="header__right">
        {install.available && (
          <button type="button" className="chip chip--install" onClick={install.prompt} title="Install Freecellin as an app">
            <InstallIcon className="chip__icon" />
            <span>Install</span>
          </button>
        )}
        <div className="chip chip--wins" title="Games won" aria-label={`${wins} games won`}>
          <CrownIcon className="chip__icon chip__icon--crown" />
          <span className="chip__value">{wins}</span>
        </div>
      </div>
    </header>
  );
}
