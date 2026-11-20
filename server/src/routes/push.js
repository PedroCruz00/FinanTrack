import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { pushEnabled, sendToUser, weeklySummary } from '../push.js';

const router = Router();

router.use((_req, res, next) => (pushEnabled ? next() : res.status(503).json({ error: 'Web Push no está configurado en el servidor' })));

/** Clave pública VAPID que el navegador necesita para suscribirse. */
router.get('/key', (_req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY }));

router.use(requireAuth);

const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(500),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

router.post('/subscribe', async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Suscripción inválida' });
  const { endpoint, keys } = parsed.data;
  // Si el endpoint ya existía (otro usuario en el mismo navegador), pasa al usuario actual.
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [req.user.id, endpoint, keys.p256dh, keys.auth],
  );
  res.status(201).json({ ok: true });
});

router.post('/unsubscribe', async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id]);
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const result = await sendToUser(req.user.id, {
    title: '¡Hola desde el servidor!',
    body: 'Las notificaciones push funcionan. Brote te avisará de lo importante.',
    url: '/settings',
    tag: 'push-test',
  });
  res.json(result);
});

router.post('/summary', async (req, res) => {
  res.json(await sendToUser(req.user.id, await weeklySummary(req.user.id)));
});

export default router;
