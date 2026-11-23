import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import receiptRoutes from './routes/receipts.js';
import pushRoutes from './routes/push.js';
import { pushEnabled, startWeeklyScheduler, TIMEZONE } from './push.js';

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env');
  process.exit(1);
}

const app = express();
// El cliente llega a través del proxy de Vite (y del túnel en el celular): la IP real viene en X-Forwarded-For.
app.set('trust proxy', 'loopback');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/categories', requireAuth, async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, type, icon FROM categories ORDER BY sort_order');
  res.json(rows);
});

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/push', pushRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Express 5 envía aquí también los errores de los handlers async.
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ status: 'error', error: 'La imagen supera el tamaño máximo (5 MB)' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API de FinanTrack en http://localhost:${port}`);
  console.log(pushEnabled ? `Web Push activo (resumen semanal: lunes 8:00, ${TIMEZONE})` : 'Web Push desactivado: faltan claves VAPID en .env');
  startWeeklyScheduler();
});
