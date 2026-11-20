import { useSyncExternalStore } from 'react';
import { api } from './api.js';
import { getMeta, setMeta } from './db.js';
import { toast } from './events.js';

/**
 * Capacidades PWA del lado de la página. Todo con detección de soporte: si el navegador no
 * ofrece algo, la app sigue funcionando y la interfaz lo explica.
 */

// ---------------------------------------------------------------------------------------------
// Instalación (beforeinstallprompt en Chromium; instrucciones manuales en iOS/Safari)
// ---------------------------------------------------------------------------------------------

const installListeners = new Set();
let deferredPrompt = null;

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: minimal-ui)').matches ||
  window.navigator.standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let justInstalled = false;
let installSnapshot = { canPrompt: false, installed: isStandalone(), iosHint: isIos() && !isStandalone() };
const emitInstall = () => {
  installSnapshot = {
    canPrompt: !!deferredPrompt,
    installed: isStandalone() || justInstalled,
    iosHint: isIos() && !isStandalone(),
  };
  installListeners.forEach((fn) => fn());
};

// Se registran al importar el módulo (desde main.jsx), antes de que el navegador dispare el evento.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // mostramos nuestra propia invitación, en el momento adecuado
  deferredPrompt = event;
  justInstalled = false;
  emitInstall();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  justInstalled = true;
  emitInstall();
  toast('¡Listo! FinanTrack quedó instalada en tu dispositivo', 'success');
});
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', emitInstall);

export function useInstall() {
  return useSyncExternalStore(
    (fn) => (installListeners.add(fn), () => installListeners.delete(fn)),
    () => installSnapshot,
  );
}

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emitInstall();
  return outcome; // 'accepted' | 'dismissed'
}

// ---------------------------------------------------------------------------------------------
// Background Sync y Periodic Background Sync
// ---------------------------------------------------------------------------------------------

const swReady = () => (navigator.serviceWorker ? navigator.serviceWorker.ready : Promise.reject(new Error('sin SW')));

/** Pide al navegador que avise al SW cuando haya red, aunque la app esté cerrada. */
export async function registerBackgroundSync() {
  try {
    const reg = await swReady();
    if ('sync' in reg) await reg.sync.register('outbox-sync');
  } catch {
    /* no soportado (Safari, Firefox): seguimos con los disparadores de la página */
  }
}

/**
 * Revisión periódica (Chromium con la app instalada): recordatorio diario, alertas de
 * presupuesto y facturas sin subir, aunque la app no se abra.
 */
export async function registerPeriodicSync() {
  try {
    const reg = await swReady();
    if (!('periodicSync' in reg)) return 'unsupported';
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return 'not-granted';
    await reg.periodicSync.register('daily-check', { minInterval: 12 * 60 * 60 * 1000 });
    return 'registered';
  } catch {
    return 'unsupported';
  }
}

export async function periodicSyncStatus() {
  try {
    const reg = await swReady();
    if (!('periodicSync' in reg)) return 'unsupported';
    const tags = await reg.periodicSync.getTags();
    return tags.includes('daily-check') ? 'registered' : 'not-registered';
  } catch {
    return 'unsupported';
  }
}

// ---------------------------------------------------------------------------------------------
// Web Push (notificaciones enviadas por el servidor)
// ---------------------------------------------------------------------------------------------

const urlB64ToUint8Array = (b64) => {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => 'PushManager' in window && 'serviceWorker' in navigator;

export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await swReady();
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador no admite notificaciones push');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Necesitamos tu permiso para enviarte notificaciones');
  const reg = await swReady();
  const { key } = await api('/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
  }
  await api('/push/subscribe', { method: 'POST', json: sub.toJSON() });
  await setMeta('pushKey', key); // el SW la usa si el navegador renueva la suscripción
  return sub;
}

export async function disablePush() {
  const sub = await getPushSubscription();
  if (!sub) return;
  await api('/push/unsubscribe', { method: 'POST', json: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

// ---------------------------------------------------------------------------------------------
// Preferencias: tema, recordatorios, almacenamiento
// ---------------------------------------------------------------------------------------------

const THEME_KEY = 'ft_theme';
const THEME_COLORS = { light: '#f5f3ee', dark: '#121211' };

export const getTheme = () => localStorage.getItem(THEME_KEY) ?? 'system';

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[dark ? 'dark' : 'light']));
}

export const getRemindersEnabled = () => getMeta('remindersEnabled', true);
export const setRemindersEnabled = (on) => setMeta('remindersEnabled', on);

export async function storageInfo() {
  const est = (await navigator.storage?.estimate?.()) ?? {};
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}

export async function requestPersistence() {
  return (await navigator.storage?.persist?.()) ?? false;
}

/** Vibración corta como confirmación táctil (si el dispositivo la admite). */
export const haptic = (ms = 12) => navigator.vibrate?.(ms);
