import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { loadDemoData } from '../lib/demo.js';
import { toast } from '../lib/events.js';
import { notificationPermission, requestNotificationPermission } from '../lib/notify.js';
import {
  applyTheme,
  disablePush,
  enablePush,
  getPushSubscription,
  getRemindersEnabled,
  getTheme,
  isStandalone,
  periodicSyncStatus,
  pushSupported,
  registerPeriodicSync,
  requestPersistence,
  setRemindersEnabled,
  storageInfo,
} from '../lib/pwa.js';
import Brote from '../components/Brote.jsx';
import Icon from '../components/Icon.jsx';
import InstallCard from '../components/InstallCard.jsx';

const THEMES = [
  ['system', 'monitor', 'Sistema'],
  ['light', 'sun', 'Claro'],
  ['dark', 'moon', 'Oscuro'],
];

const mb = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Qué capacidades PWA ofrece este navegador (detección en vivo). */
function capabilities() {
  const reg = navigator.serviceWorker?.controller;
  return [
    ['Service worker activo', !!reg, 'Cachea la app para abrir sin conexión'],
    ['Base de datos local (IndexedDB)', 'indexedDB' in window, 'Movimientos, presupuestos, facturas y cola'],
    ['Instalable', 'BeforeInstallPromptEvent' in window || isStandalone() || /iphone|ipad/i.test(navigator.userAgent), 'Manifiesto con íconos, atajos y capturas'],
    ['Background Sync', 'SyncManager' in window, 'Envía la cola aunque cierres la app'],
    ['Periodic Background Sync', 'PeriodicSyncManager' in window, 'Recordatorio diario con la app instalada'],
    ['Notificaciones', 'Notification' in window, 'Alertas de presupuesto locales'],
    ['Web Push', pushSupported(), 'Resumen semanal desde el servidor'],
    ['Compartir hacia la app (Share Target)', 'serviceWorker' in navigator, 'Recibe fotos de facturas desde la galería (app instalada en Android)'],
    ['Compartir desde la app (Web Share)', 'share' in navigator, 'Comparte reportes y CSV'],
    ['Insignia en el ícono (Badging)', 'setAppBadge' in navigator, 'Muestra los cambios pendientes'],
    ['Web Locks', 'locks' in navigator, 'Evita sincronizaciones simultáneas entre pestañas'],
    ['Almacenamiento persistente', !!navigator.storage?.persist, 'Protege los datos de la limpieza automática'],
    ['Cámara', 'mediaDevices' in navigator, 'Fotografía las facturas'],
    ['Vibración', 'vibrate' in navigator, 'Confirmación táctil al guardar'],
  ];
}

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} aria-label={label} />
    </label>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getTheme());
  const [perm, setPerm] = useState(notificationPermission());
  const [push, setPush] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [periodic, setPeriodic] = useState('unsupported');
  const [storage, setStorage] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    getPushSubscription().then((s) => setPush(!!s)).catch(() => {});
    getRemindersEnabled().then(setReminders);
    periodicSyncStatus().then(setPeriodic);
    storageInfo().then(setStorage);
  }, []);

  const run = (key, fn) => async (...args) => {
    setBusy(key);
    try {
      await fn(...args);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const togglePush = run('push', async (on) => {
    if (on) {
      await enablePush();
      setPush(true);
      setPerm(notificationPermission());
      toast('Notificaciones push activadas en este dispositivo', 'success');
    } else {
      await disablePush();
      setPush(false);
    }
  });

  const toggleReminders = run('reminders', async (on) => {
    await setRemindersEnabled(on);
    setReminders(on);
    if (on) setPeriodic(await registerPeriodicSync());
  });

  const askPermission = run('perm', async () => setPerm(await requestNotificationPermission()));

  const persist = run('persist', async () => {
    const ok = await requestPersistence();
    toast(ok ? 'Tus datos quedaron protegidos' : 'El navegador no lo concedió todavía (suele hacerlo al instalar la app)', ok ? 'success' : 'info');
    setStorage(await storageInfo());
  });

  const demo = run('demo', async () => {
    if (!window.confirm('Se agregarán unos 4 meses de movimientos y presupuestos de ejemplo a tu cuenta. ¿Continuar?')) return;
    const n = await loadDemoData();
    toast(`Agregué ${n} movimientos de ejemplo`, 'success');
    navigate('/');
  });

  return (
    <div className="page">
      <section className="profile">
        <Brote mood="happy" size={72} />
        <div>
          <h1 className="page-title">{user?.name}</h1>
          <p className="muted">{user?.email}</p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Aplicación</h2>
        <InstallCard compact />
        <Link to="/sync" className="setting-row">
          <Icon name="sync" />
          <span className="setting-main">
            <span>Sincronización</span>
            <small>Estado, cola de envío y errores</small>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
      </section>

      <section className="section">
        <h2 className="section-title">Notificaciones</h2>
        <div className="setting-row">
          <Icon name="bell" />
          <span className="setting-main">
            <span>Alertas de presupuesto</span>
            <small>
              {perm === 'granted'
                ? 'Activadas: te aviso al llegar a tu límite'
                : perm === 'denied'
                  ? 'Bloqueadas en el navegador; se muestran dentro de la app'
                  : perm === 'unsupported'
                    ? 'No disponibles en este navegador'
                    : 'Se muestran dentro de la app'}
            </small>
          </span>
          {perm === 'default' && (
            <button className="btn btn-sm" onClick={askPermission} disabled={busy === 'perm'}>
              Activar
            </button>
          )}
        </div>
        <div className="setting-row">
          <Icon name="bolt" />
          <span className="setting-main">
            <span>Notificaciones push</span>
            <small>{pushSupported() ? 'Resumen semanal y avisos del servidor, aunque la app esté cerrada' : 'No disponibles en este navegador'}</small>
          </span>
          <Toggle checked={push} onChange={togglePush} disabled={!pushSupported() || busy === 'push'} label="Notificaciones push" />
        </div>
        {push && (
          <div className="setting-actions">
            <button className="btn btn-sm" onClick={run('test', () => api('/push/test', { method: 'POST' }))}>
              Enviar prueba
            </button>
            <button className="btn btn-sm btn-ghost" onClick={run('summary', () => api('/push/summary', { method: 'POST' }))}>
              Resumen semanal ahora
            </button>
          </div>
        )}
        <div className="setting-row">
          <Icon name="clock" />
          <span className="setting-main">
            <span>Recordatorio diario</span>
            <small>
              {periodic === 'registered'
                ? 'Activo: si a las 6 p. m. no hay gastos del día, te lo recuerdo'
                : periodic === 'not-granted' || periodic === 'not-registered'
                  ? 'Disponible al instalar la app'
                  : 'Este navegador no admite revisiones en segundo plano'}
            </small>
          </span>
          <Toggle checked={reminders} onChange={toggleReminders} disabled={busy === 'reminders'} label="Recordatorio diario" />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Apariencia</h2>
        <div className="theme-picker" role="radiogroup" aria-label="Tema">
          {THEMES.map(([k, icon, label]) => (
            <button
              key={k}
              role="radio"
              aria-checked={theme === k}
              className={`theme-option ${theme === k ? 'active' : ''}`}
              onClick={() => {
                applyTheme(k);
                setTheme(k);
              }}
            >
              <span className={`theme-swatch swatch-${k}`}>
                <Icon name={icon} size={18} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Datos y almacenamiento</h2>
        {storage && (
          <div className="setting-row">
            <Icon name="shield" />
            <span className="setting-main">
              <span>{mb(storage.usage)} usados en este dispositivo</span>
              <small>{storage.persisted ? 'Protegidos: el navegador no los borrará para liberar espacio' : 'El navegador podría borrarlos si se queda sin espacio'}</small>
            </span>
            {!storage.persisted && (
              <button className="btn btn-sm" onClick={persist} disabled={busy === 'persist'}>
                Proteger
              </button>
            )}
          </div>
        )}
        <button className="setting-row" onClick={demo} disabled={busy === 'demo'}>
          <Icon name="sparkle" />
          <span className="setting-main">
            <span>Cargar datos de ejemplo</span>
            <small>Cuatro meses de movimientos para explorar o presentar la app</small>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
        <Link to="/reports" className="setting-row">
          <Icon name="download" />
          <span className="setting-main">
            <span>Exportar a CSV</span>
            <small>Desde Reportes, por mes o todo el historial</small>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
      </section>

      <details className="section capabilities">
        <summary>
          <span className="section-title">Capacidades PWA de este navegador</span>
        </summary>
        <ul className="cap-list">
          {capabilities().map(([name, ok, hint]) => (
            <li key={name} className={ok ? 'ok' : 'no'}>
              <span className="cap-mark">
                <Icon name={ok ? 'check' : 'close'} size={14} />
              </span>
              <span>
                {name}
                <small>{ok ? hint : 'No disponible aquí; la app sigue funcionando sin esto'}</small>
              </span>
            </li>
          ))}
        </ul>
      </details>

      <section className="section">
        <button
          className="btn btn-block"
          onClick={async () => {
            if (await logout()) navigate('/login');
          }}
        >
          <Icon name="logout" size={18} /> Cerrar sesión
        </button>
        <p className="hint center">
          FinanTrack {__APP_VERSION__} · compilada el {new Date(__BUILD_DATE__).toLocaleDateString('es-CO')}
        </p>
      </section>
    </div>
  );
}
