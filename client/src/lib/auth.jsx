import { createContext, useContext, useState } from 'react';
import { api, session } from './api.js';
import { clearLocalData, db } from './db.js';
import { refreshCategories } from './sync.js';
import { disablePush } from './pwa.js';

const AuthContext = createContext(null);
const LAST_USER_KEY = 'ft_last_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(session.user);

  async function authenticate(mode, { name, email, password }) {
    const res = await api(`/auth/${mode}`, { method: 'POST', json: { name, email, password } });
    // Si entra otro usuario en este dispositivo, se borran los datos locales del anterior.
    if (localStorage.getItem(LAST_USER_KEY) !== res.user.id) await clearLocalData();
    await session.save(res.token, res.user);
    localStorage.setItem(LAST_USER_KEY, res.user.id);
    await refreshCategories();
    setUser(res.user);
  }

  /** Cierra sesión y borra los datos del dispositivo. Devuelve false si el usuario cancela. */
  async function logout() {
    const pending = await db.outbox.count();
    if (
      pending > 0 &&
      !window.confirm(
        `Tienes ${pending} cambio(s) sin sincronizar que se perderán al cerrar sesión. ¿Cerrar sesión de todos modos?`,
      )
    ) {
      return false;
    }
    // Este dispositivo deja de recibir las notificaciones push de la cuenta.
    await disablePush().catch(() => {});
    navigator.clearAppBadge?.().catch(() => {});
    await clearLocalData();
    localStorage.removeItem(LAST_USER_KEY);
    await session.clear();
    setUser(null);
    return true;
  }

  /** Sesión expirada: se pide iniciar sesión otra vez SIN borrar los datos pendientes. */
  function reauthenticate() {
    session.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, authenticate, logout, reauthenticate }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
