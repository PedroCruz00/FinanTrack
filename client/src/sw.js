/// <reference lib="webworker" />
/**
 * Service worker de FinanTrack (estrategia injectManifest de vite-plugin-pwa).
 *
 *  - Precaché de la app (shell) y navegación offline → index.html
 *  - Actualización controlada por el usuario (mensaje SKIP_WAITING)
 *  - Web Share Target: recibe fotos de facturas desde la galería u otras apps
 *  - Background Sync: envía la cola pendiente aunque la app esté cerrada
 *  - Periodic Background Sync: recordatorio diario, alertas y facturas sin subir
 *  - Web Push y clics en notificaciones
 *
 * Los datos financieros viven en IndexedDB (Dexie), nunca en la Cache Storage.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { db, getMeta, setMeta } from './lib/db.js';
import { setApiToken } from './lib/api.js';
import { runSyncCycle, updateAppBadge } from './lib/sync-core.js';
import { checkBudgetAlerts } from './lib/budgets.js';
import { NOTIFICATION_DEFAULTS, showSystemNotification } from './lib/notify.js';
import { toDateKey } from './lib/util.js';

self.__WB_DISABLE_DEV_LOGS = true;

// ---------- App shell ----------
const manifest = self.__WB_MANIFEST;
cleanupOutdatedCaches();
precacheAndRoute(manifest);
if (manifest.some((e) => (typeof e === 'string' ? e : e.url).endsWith('index.html'))) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//, /^\/share-target/] }));
}

// La nueva versión espera a que el usuario pulse "Actualizar" (no recargamos en mitad de un formulario).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
clientsClaim();

// ---------- Web Share Target ----------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const files = form.getAll('receipt').filter((f) => f instanceof Blob && f.type.startsWith('image/'));
        await db.shared.clear();
        await db.shared.bulkAdd(files.map((blob) => ({ blob, name: blob.name ?? 'factura', receivedAt: Date.now() })));
        const text = [form.get('title'), form.get('text')].filter(Boolean).join(' ').slice(0, 120);
        const target = `/transactions/new?shared=${files.length}${text ? `&note=${encodeURIComponent(text)}` : ''}`;
        return Response.redirect(target, 303);
      } catch {
        return Response.redirect('/transactions/new', 303);
      }
    })(),
  );
});

// ---------- Background Sync ----------
async function visibleClients() {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return { all, visible: all.filter((c) => c.visibilityState === 'visible') };
}

async function syncInBackground() {
  const { all, visible } = await visibleClients();
  if (visible.length) {
    // Con la app a la vista, la página sincroniza (así actualiza su interfaz al instante).
    visible.forEach((c) => c.postMessage({ type: 'run-sync' }));
    return;
  }
  const token = await getMeta('authToken');
  if (!token) return;
  setApiToken(token);
  await runSyncCycle({ manual: true }); // si falla la red, lanza y el navegador reintenta luego
  await checkBudgetAlerts();
  all.forEach((c) => c.postMessage({ type: 'sync-done' }));
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') event.waitUntil(syncInBackground());
});

// ---------- Periodic Background Sync ----------
async function dailyCheck() {
  const token = await getMeta('authToken');
  if (!token) return;
  setApiToken(token);
  try {
    await runSyncCycle();
  } catch {
    /* sin red: igual revisamos lo local */
  }
  await checkBudgetAlerts();
  await updateAppBadge();

  const today = toDateKey();
  const hour = new Date().getHours();

  // Recordatorio para registrar gastos (una vez al día, por la tarde, si no hay nada hoy)
  if ((await getMeta('remindersEnabled', true)) && hour >= 18 && (await getMeta('lastReminder')) !== today) {
    const count = await db.transactions.where('date').equals(today).count();
    if (!count) {
      await setMeta('lastReminder', today);
      await showSystemNotification('¿Cómo te fue hoy?', {
        body: 'Brote no ha visto gastos registrados hoy. Te toma 10 segundos anotarlos.',
        url: '/transactions/new',
        tag: 'daily-reminder',
        actions: [{ action: 'add-expense', title: 'Registrar gasto' }],
      });
    }
  }

  // Facturas que llevan más de un día sin subir
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const stuck = await db.outbox
    .filter((o) => o.entity === 'receipt' && o.action === 'upsert' && Date.parse(o.createdAt) < dayAgo)
    .count();
  if (stuck && (await getMeta('lastStuckNotice')) !== today) {
    await setMeta('lastStuckNotice', today);
    await showSystemNotification('Facturas sin respaldar', {
      body: `Tienes ${stuck} factura${stuck > 1 ? 's' : ''} guardada${stuck > 1 ? 's' : ''} solo en este dispositivo. Abre la app con conexión para subirlas.`,
      url: '/sync',
      tag: 'stuck-receipts',
    });
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-check') event.waitUntil(dailyCheck());
});

// ---------- Web Push ----------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FinanTrack', {
      ...NOTIFICATION_DEFAULTS,
      body: data.body ?? '',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  );
});

// El navegador puede renovar la suscripción: la volvemos a registrar en el servidor.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const [token, key] = await Promise.all([getMeta('authToken'), getMeta('pushKey')]);
      if (!token || !key) return;
      const padding = '='.repeat((4 - (key.length % 4)) % 4);
      const raw = atob((key + padding).replace(/-/g, '+').replace(/_/g, '/'));
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });
    })(),
  );
});

// ---------- Clic en notificaciones ----------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.action === 'add-expense' ? '/transactions/new' : (event.notification.data?.url ?? '/');
  event.waitUntil(
    (async () => {
      const { all } = await visibleClients();
      const client = all[0];
      if (client) {
        await client.focus();
        client.postMessage({ type: 'navigate', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
