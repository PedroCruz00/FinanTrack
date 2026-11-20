import { emit } from './events.js';
import { db } from './db.js';

const TOKEN_KEY = 'ft_token';
const USER_KEY = 'ft_user';
const hasLocalStorage = typeof localStorage !== 'undefined';

// En el service worker no existe localStorage: el token se lee de IndexedDB (meta.authToken).
let workerToken = null;
export const setApiToken = (token) => {
  workerToken = token;
};

export const session = {
  get token() {
    return hasLocalStorage ? localStorage.getItem(TOKEN_KEY) : workerToken;
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // Copia para que el service worker pueda sincronizar con la app cerrada.
    return db.meta.put({ key: 'authToken', value: token });
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return db.meta.delete('authToken');
  },
};

export class ApiError extends Error {
  constructor(status, message, body = {}) {
    super(message);
    this.status = status; // 0 = sin conexión / servidor inalcanzable
    this.body = body;
  }
  get isNetwork() {
    return this.status === 0 || this.status >= 500;
  }
}

/** fetch hacia /api con token y manejo uniforme de errores. */
export async function api(path, { method = 'GET', json, formData, raw = false } = {}) {
  const headers = {};
  const token = session.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (formData) {
    body = formData;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor');
  }

  if (res.status === 401 && token) emit('unauthorized');
  if (raw && res.ok) return res;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Error ${res.status}`, data);
  return data;
}
