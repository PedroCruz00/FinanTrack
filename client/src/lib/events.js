/** Emisor de eventos mínimo para avisos (toasts) y sesión. */
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, data) {
  listeners.get(event)?.forEach((fn) => fn(data));
}

/** kind: 'info' | 'success' | 'warning' | 'error' */
export function toast(message, kind = 'info') {
  emit('toast', { id: Math.random().toString(36).slice(2), message, kind });
}
