import { toast } from './events.js';

/**
 * Notificaciones locales (Notifications API). Funcionan sin servidor y también desde el
 * service worker. Si la app está visible se muestra solo el aviso interno, para no duplicar.
 */

const scope = globalThis;
const inWorker = typeof scope.WorkerGlobalScope !== 'undefined' && scope instanceof scope.WorkerGlobalScope;

export const notificationsSupported = () => 'Notification' in scope;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'unsupported');

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

export const NOTIFICATION_DEFAULTS = {
  icon: '/icons/icon-192.png',
  badge: '/icons/badge-96.png',
  lang: 'es',
};

export async function showSystemNotification(title, { body, url = '/', tag, actions, requireInteraction } = {}) {
  if (notificationPermission() !== 'granted') return false;
  const reg = inWorker ? scope.registration : await navigator.serviceWorker?.getRegistration();
  const options = { ...NOTIFICATION_DEFAULTS, body, tag: tag ?? title, data: { url }, actions, requireInteraction };
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
  return true;
}

/** Aviso con la app abierta (toast) o notificación del sistema si está en segundo plano. */
export async function notify(title, body, kind = 'warning', url = '/budgets') {
  const visible = !inWorker && scope.document?.visibilityState === 'visible';
  if (visible) {
    toast(`${title}. ${body}`, kind);
    return;
  }
  try {
    await showSystemNotification(title, { body, url });
  } catch {
    /* sin permiso: no hay más que hacer */
  }
}
