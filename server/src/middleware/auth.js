import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  // Un token sigue siendo válido aunque la cuenta se haya eliminado desde otro dispositivo.
  const [rows] = await pool.query('SELECT 1 FROM users WHERE id = ?', [payload.sub]);
  if (!rows.length) return res.status(401).json({ error: 'La cuenta ya no existe' });
  req.user = { id: payload.sub, name: payload.name, email: payload.email };
  next();
}
