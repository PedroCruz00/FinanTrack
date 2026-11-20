import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// pwa.js se importa primero: escucha beforeinstallprompt antes de que el navegador lo dispare
import { applyTheme } from './lib/pwa.js';
import App from './App.jsx';
import './fonts.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './styles.css';

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
