import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Brote from '../components/Brote.jsx';

export default function Login() {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isRegister = mode === 'register';

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!navigator.onLine) {
      setError('Necesitas conexión para entrar la primera vez. Después la app funciona sin Internet.');
      return;
    }
    setBusy(true);
    try {
      await authenticate(mode, form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-intro">
        <Brote mood={error ? 'worried' : busy ? 'think' : 'wave'} size={132} label="Brote, la mascota de FinanTrack" />
        <p className="wordmark big">
          Finan<em>track</em>
        </p>
        <p className="auth-tagline">
          Tu dinero, <em>en claro.</em>
          <br />
          Con o sin conexión.
        </p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <h1>{isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h1>
        {isRegister && (
          <label className="line-field">
            <span>Nombre</span>
            <input value={form.name} onChange={set('name')} required autoComplete="name" />
          </label>
        )}
        <label className="line-field">
          <span>Correo</span>
          <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
        </label>
        <label className="line-field">
          <span>Contraseña{isRegister && <small> · mínimo 8 caracteres</small>}</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Entrar'}
        </button>
        <p className="auth-switch">
          {isRegister ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}{' '}
          <button type="button" className="btn-text" onClick={() => setMode(isRegister ? 'login' : 'register')}>
            {isRegister ? 'Inicia sesión' : 'Crea una cuenta'}
          </button>
        </p>
      </form>
    </div>
  );
}
