import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { CrownIcon, InstallIcon } from './icons';
import { Logo } from './Logo';

export function GameHeader({ wins }: { wins: number }) {
  const install = useInstallPrompt();
  return (
    <header className="header">
      {/* Soft green hills that lead into the board below. */}
      <svg className="header__hills" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 58C150 18 300 18 420 52S700 112 1000 28V120H0Z" fill="#e2ebd6" />
        <path d="M0 96C200 70 380 76 520 100S820 102 1000 72V120H0Z" fill="#cbdcba" />
      </svg>

      <h1 className="header__title">
        <Logo />
      </h1>

      <div className="header__chips">
        {install.available && (
          <button type="button" className="chip chip--install" onClick={install.prompt} title="Install Freecellin as an app">
            <InstallIcon className="chip__icon" />
            <span className="chip__label">Install</span>
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
