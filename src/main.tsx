import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
// Bundled locally (OFL-1.1) so the logo font also works offline.
import '@fontsource/fredoka/latin-700.css';
import './styles/global.css';
import './styles/game.css';
import './styles/card.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: precaches the app shell and all sound files for offline play.
registerSW({ immediate: true });
