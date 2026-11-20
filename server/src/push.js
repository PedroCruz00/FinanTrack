import * as webpush from 'web-push';
import { pool } from './db.js';

/**
 * Web Push con claves VAPID. Si no hay claves en .env, el servidor funciona igual
 * y las rutas de push responden 503.
 */
export const pushEnabled = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

/** Envía una notificación a todos los dispositivos del usuario y limpia las suscripciones caducadas. */
export async function sendToUser(userId, payload) {
  if (!pushEnabled) return { sent: 0, removed: 0 };
  const [subs] = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]);
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: payload.urgency ?? 'normal', topic: payload.tag?.slice(0, 32) },
        );
        sent++;
      } catch (err) {
        // 404/410: el navegador revocó la suscripción
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
          removed++;
        } else {
          console.warn('Push fallido:', err.statusCode ?? err.message);
        }
      }
    }),
  );
  return { sent, removed };
}

const money = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

/** Resumen de los últimos 7 días calculado en la base de datos. */
export async function weeklySummary(userId) {
  const [[totals]] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense,
       COUNT(*) AS count
     FROM transactions
     WHERE user_id = ? AND deleted = 0 AND date >= CURDATE() - INTERVAL 7 DAY`,
    [userId],
  );
  const [[top]] = await pool.query(
    `SELECT c.name, SUM(t.amount) AS total
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.deleted = 0 AND t.type = 'expense' AND t.date >= CURDATE() - INTERVAL 7 DAY
     GROUP BY c.name ORDER BY total DESC LIMIT 1`,
    [userId],
  );

  if (!totals.count) {
    return {
      title: 'Tu semana con Brote',
      body: 'No registraste movimientos esta semana. ¿Empezamos hoy?',
      url: '/transactions/new',
      tag: 'weekly-summary',
    };
  }
  const parts = [`Gastaste ${money(totals.expense)}`];
  if (totals.income > 0) parts.push(`ingresaron ${money(totals.income)}`);
  if (top) parts.push(`lo que más pesó fue ${top.name.toLowerCase()} (${money(top.total)})`);
  return {
    title: 'Tu resumen de la semana',
    body: `${parts.join(', ')}.`,
    url: '/reports',
    tag: 'weekly-summary',
  };
}

/** Programa el resumen semanal: lunes a las 8:00 (hora del servidor). */
export function startWeeklyScheduler() {
  if (!pushEnabled) return;
  let lastRun = null;
  const tick = async () => {
    const now = new Date();
    const key = now.toISOString().slice(0, 10);
    if (now.getDay() !== 1 || now.getHours() !== 8 || lastRun === key) return;
    lastRun = key;
    const [users] = await pool.query('SELECT DISTINCT user_id FROM push_subscriptions');
    for (const { user_id: userId } of users) {
      await sendToUser(userId, await weeklySummary(userId)).catch((e) => console.warn(e.message));
    }
    console.log(`Resumen semanal enviado a ${users.length} usuario(s)`);
  };
  setInterval(() => tick().catch((e) => console.warn(e.message)), 10 * 60 * 1000);
}
