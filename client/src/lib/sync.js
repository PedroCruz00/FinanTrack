import { useSyncExternalStore } from 'react';
import { session } from './api.js';
import { db, getMeta, setMeta, tableFor } from './db.js';
import { checkBudgetAlerts } from './budgets.js';
import { refreshCategories, runSyncCycle, updateAppBadge } from './sync-core.js';
import { registerBackgroundSync } from './pwa.js';

export { refreshCategories };

/**
 * Motor de sincronización (lado página).
 *
 * Disparadores: al abrir la app, al recuperar la conexión, al volver a la pestaña, tras cada
 * cambio local (con un pequeño retardo), cada minuto y con el botón manual. Además se registra
 * Background Sync: si la página se cierra con cambios pendientes, el service worker los envía
 * cuando vuelva la red (en navegadores que lo soportan; nunca dependemos solo de eso).
 */

let state = { running: false, lastSyncAt: null, lastError: null, online: navigator.onLine };
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function useSyncState() {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => state,
  );
}

export async function syncNow({ manual = false } = {}) {
  if (state.running || !session.token) return;
  if (!navigator.onLine) {
    setState({ lastError: 'Sin conexión: los cambios se guardan en el dispositivo' });
    registerBackgroundSync();
    return;
  }
  setState({ running: true });
  try {
    const result = await runSyncCycle({ manual });
    if (result !== 'busy') setState({ lastSyncAt: new Date(), lastError: null });
  } catch (err) {
    const message =
      err.status === 401 ? 'Sesión expirada: vuelve a iniciar sesión para sincronizar' : err.message;
    setState({ lastError: message });
    if (err.isNetwork) registerBackgroundSync();
  } finally {
    setState({ running: false });
  }
  checkBudgetAlerts();
}

/** Reintenta las operaciones que quedaron con error. */
export async function retryFailed() {
  const failed = await db.outbox.where('status').equals('error').toArray();
  for (const op of failed) {
    await db.outbox.update(op.seq, { status: 'pending', attempts: 0, nextAttemptAt: 0 });
    await tableFor[op.entity].update(op.entityId, { syncStatus: 'pending' });
  }
  return syncNow({ manual: true });
}

/**
 * Descarta una operación fallida: se borra la copia local del registro y se hace un pull
 * completo, de modo que queda la versión del servidor (si existe).
 */
export async function discardOperation(seq) {
  const op = await db.outbox.get(seq);
  if (!op) return;
  await db.transaction('rw', db.outbox, db.transactions, db.budgets, db.receipts, db.meta, async () => {
    await db.outbox.where('entityId').equals(op.entityId).delete();
    await tableFor[op.entity].delete(op.entityId);
    await setMeta('lastPull', null);
  });
  syncNow({ manual: true });
}

let timer;
/** Pide una sincronización pronto (tras un cambio local). */
export function requestSync() {
  updateAppBadge();
  registerBackgroundSync();
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), 800);
}

let started = false;
export function startSyncEngine() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => {
    setState({ online: true });
    syncNow();
  });
  window.addEventListener('offline', () => setState({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  // El service worker avisa cuando sincronizó en segundo plano o pide que la página lo haga.
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'run-sync') syncNow();
    if (event.data?.type === 'sync-done') setState({ lastSyncAt: new Date(), lastError: null });
  });
  getMeta('lastSyncAt').then((iso) => iso && !state.lastSyncAt && setState({ lastSyncAt: new Date(iso) }));
  setInterval(() => syncNow(), 60_000);
  syncNow();
}
