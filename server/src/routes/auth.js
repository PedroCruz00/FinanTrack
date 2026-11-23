import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { passwordLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { removeUserUploads } from '../uploads.js';

const router = Router();

const password = z.string().min(8).max(100);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase().max(255),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: password,
});

const deleteAccountSchema = z.object({ password: z.string() });

async function checkPassword(userId, plain) {
  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  return rows.length > 0 && bcrypt.compare(plain, rows[0].password_hash);
}

router.post('/register', registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos: nombre, correo válido y contraseña de al menos 8 caracteres' });
  }
  const { name, email, password } = parsed.data;
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

  const user = { id: randomUUID(), name, email };
  const hash = await bcrypt.hash(password, 12);
  await pool.query('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)', [
    user.id, name, email, hash,
  ]);
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', passwordLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  const { email, password } = parsed.data;
  const [rows] = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ token: signToken(user), user });
});

// Con sesión iniciada, una contraseña incorrecta responde 403 y no 401:
// el cliente interpreta el 401 como sesión expirada.
router.put('/password', requireAuth, passwordLimiter, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  const { currentPassword, newPassword } = parsed.data;
  if (!(await checkPassword(req.user.id, currentPassword))) {
    return res.status(403).json({ error: 'La contraseña actual no es correcta' });
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
});

router.delete('/account', requireAuth, passwordLimiter, async (req, res) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  if (!(await checkPassword(req.user.id, parsed.data.password))) {
    return res.status(403).json({ error: 'La contraseña no es correcta' });
  }
  // Las claves foráneas con ON DELETE CASCADE eliminan movimientos, presupuestos,
  // facturas, operaciones procesadas y suscripciones push.
  await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);
  await removeUserUploads(req.user.id).catch((err) => console.warn('No se pudieron borrar las facturas:', err.message));
  res.json({ ok: true });
});

export default router;
