import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase().max(255),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

router.post('/register', async (req, res) => {
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

router.post('/login', async (req, res) => {
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

export default router;
