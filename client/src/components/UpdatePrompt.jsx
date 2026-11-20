import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '../lib/events.js';
import Brote from './Brote.jsx';
import Icon from './Icon.jsx';

/**
 * Registro del service worker y ciclo de actualización:
 *  - "offlineReady": la primera vez que la app queda lista para funcionar sin red.
 *  - "needRefresh": hay una versión nueva esperando; el usuario decide cuándo aplicarla.
 * Además busca actualizaciones cada hora y al volver a la pestaña.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => navigator.onLine && reg.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast('Lista: FinanTrack ya funciona sin conexión', 'success');
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh) return null;
  return (
    <div className="update-bar" role="alert">
      <Brote mood="celebrate" size={44} animated={false} />
      <span className="update-text">
        <strong>Hay una versión nueva</strong>
        <small>Actualiza para estrenar las mejoras.</small>
      </span>
      <button className="btn btn-sm btn-primary" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
      <button className="icon-btn ghost" onClick={() => setNeedRefresh(false)} aria-label="Más tarde">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
