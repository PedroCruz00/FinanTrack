import { useState } from 'react';
import { promptInstall, useInstall } from '../lib/pwa.js';
import Brote from './Brote.jsx';
import Icon from './Icon.jsx';

const DISMISS_KEY = 'ft_install_dismissed';
const DISMISS_DAYS = 14;

function dismissedRecently() {
  const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
  return Date.now() - at < DISMISS_DAYS * 86400000;
}

/**
 * Invitación a instalar. En Chromium usa el diálogo nativo (beforeinstallprompt);
 * en iPhone/iPad explica el paso manual (Compartir → Agregar a inicio).
 * `compact` = versión para Ajustes, siempre visible y sin opción de descartar.
 */
export default function InstallCard({ compact = false }) {
  const { canPrompt, installed, iosHint } = useInstall();
  const [hidden, setHidden] = useState(() => !compact && dismissedRecently());

  if (installed) {
    return compact ? (
      <p className="setting-note">
        <Icon name="check" size={16} /> FinanTrack está instalada en este dispositivo.
      </p>
    ) : null;
  }
  if (hidden || (!canPrompt && !iosHint)) {
    return compact ? (
      <p className="setting-note">
        Abre la app en Chrome, Edge o Safari para instalarla. Si ya está instalada, ábrela desde tu pantalla de inicio.
      </p>
    ) : null;
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  return (
    <section className={`install-card ${compact ? 'compact' : ''}`} aria-label="Instalar FinanTrack">
      {!compact && <Brote mood="wave" size={76} />}
      <div className="install-body">
        <strong>Llévame en tu pantalla de inicio</strong>
        {iosHint ? (
          <p>
            Toca <Icon name="share" size={15} className="inline-icon" /> <b>Compartir</b> y luego{' '}
            <b>Agregar a inicio</b>. Abriré a pantalla completa y funcionaré sin conexión.
          </p>
        ) : (
          <p>Abre más rápido, a pantalla completa y sin conexión. Además podrás compartirme fotos de facturas.</p>
        )}
        <div className="install-actions">
          {canPrompt && (
            <button className="btn btn-primary btn-sm" onClick={promptInstall}>
              <Icon name="download" size={16} /> Instalar app
            </button>
          )}
          {!compact && (
            <button className="btn-text" onClick={dismiss}>
              Ahora no
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
