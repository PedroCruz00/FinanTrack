import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useOutbox } from '../lib/hooks.js';
import { startSyncEngine, useSyncState } from '../lib/sync.js';
import Icon from './Icon.jsx';
import Toasts from './Toasts.jsx';
import Brote from './Brote.jsx';
import Onboarding, { needsOnboarding } from './Onboarding.jsx';
import { getRemindersEnabled, registerPeriodicSync } from '../lib/pwa.js';
import { updateAppBadge } from '../lib/sync-core.js';

const LEFT = [
  ['/', 'home', 'Inicio'],
  ['/transactions', 'list', 'Movimientos'],
];
const RIGHT = [
  ['/budgets', 'target', 'Presupuestos'],
  ['/reports', 'chart', 'Reportes'],
];

function SyncIndicator() {
  const sync = useSyncState();
  const outbox = useOutbox();
  const errors = outbox.filter((o) => o.status === 'error').length;
  const pending = outbox.length - errors;

  let label = 'Al día';
  let tone = 'ok';
  let icon = 'check';
  if (!sync.online) [label, tone, icon] = ['Sin conexión', 'offline', 'cloudOff'];
  else if (sync.running) [label, tone, icon] = ['Sincronizando', 'busy', 'sync'];
  if (errors) [label, tone, icon] = [`${errors} con error`, 'error', 'alert'];
  else if (pending) label = `${pending} pendiente${pending > 1 ? 's' : ''}`;

  return (
    <Link to="/sync" className={`sync-pill sync-${tone}`} title={sync.lastError ?? 'Sincronización y cuenta'}>
      <Icon name={icon} size={15} className={sync.running ? 'spin' : ''} />
      <span>{label}</span>
    </Link>
  );
}

function DockLink([to, icon, label]) {
  return (
    <NavLink key={to} to={to} end={to === '/'} className="dock-link" aria-label={label}>
      <Icon name={icon} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, reauthenticate } = useAuth();
  const [onboarding, setOnboarding] = useState(needsOnboarding);
  const sync = useSyncState();
  const { pathname } = useLocation();
  const inForm = pathname.startsWith('/transactions/');

  useEffect(() => {
    startSyncEngine();
    updateAppBadge();
    // Revisión diaria en segundo plano (solo Chromium con la app instalada; si no, no pasa nada)
    getRemindersEnabled().then((on) => on && registerPeriodicSync());
  }, []);

  // Llaves obligatorias: en Chrome reciente scrollTo devuelve una promesa y React la tomaría como limpieza.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const expired = sync.lastError?.startsWith('Sesión expirada');

  return (
    <div className={`app ${inForm ? 'app-form' : ''}`}>
      {!inForm && (
        <header className="topbar">
          <Link to="/" className="wordmark">
            Finan<em>track</em>
          </Link>
          <span className="topbar-actions">
            <SyncIndicator />
            <Link to="/settings" className="avatar-btn" aria-label="Ajustes y cuenta" title="Ajustes y cuenta">
              {user?.name?.trim()?.[0]?.toUpperCase() ?? <Icon name="settings" size={18} />}
            </Link>
          </span>
        </header>
      )}

      {expired && (
        <div className="notice notice-warning">
          <Brote mood="worried" size={36} animated={false} />
          <span>Tu sesión expiró. Tus cambios siguen guardados en este dispositivo.</span>
          <button className="btn-text" onClick={reauthenticate}>
            Entrar
          </button>
        </div>
      )}

      <main className="content" key={pathname}>
        <Outlet />
      </main>

      {!inForm && (
        <nav className="dock" aria-label="Principal">
          {LEFT.map(DockLink)}
          <Link to="/transactions/new" className="dock-add" aria-label="Nuevo movimiento">
            <Icon name="plus" size={26} />
          </Link>
          {RIGHT.map(DockLink)}
        </nav>
      )}
      <Toasts />
      {onboarding && <Onboarding onDone={() => setOnboarding(false)} />}
    </div>
  );
}
