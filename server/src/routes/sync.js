import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { removeUploads } from '../uploads.js';

/**
 * Sincronización
 *
 * POST /api/sync/push  -> recibe la cola de operaciones del dispositivo y las aplica en orden.
 * GET  /api/sync/pull  -> devuelve los cambios del usuario posteriores a `since`.
 *
 * Reglas:
 *  - Idempotencia: cada operación trae un opId (UUID). Si ya se procesó, se devuelve el
 *    resultado guardado en processed_operations sin volver a aplicarla.
 *  - Conflictos: "última escritura gana" según updatedAt del dispositivo. Si llega una
 *    versión más antigua que la guardada, se responde `stale` y el cliente adopta la del
 *    servidor en el siguiente pull.
 *  - Las eliminaciones son lógicas (deleted = 1) para que los demás dispositivos se enteren,
 *    y siempre ganan: un registro eliminado no se revive con una edición antigua.
 */

const router = Router();
router.use(requireAuth);

const uuid = z.uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max) => z.string().trim().max(max).nullish().transform((v) => v || null);

const envelopeSchema = z.object({
  opId: uuid,
  entity: z.enum(['transaction', 'budget', 'receipt']),
  action: z.enum(['upsert', 'delete']),
  entityId: uuid,
  updatedAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()).nullish(),
});

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1).max(40),
  amount: z.number().positive().max(999_999_999_999),
  date: isoDate,
  description: optionalText(255),
  paymentMethod: optionalText(30),
  merchant: optionalText(120),
});

const budgetSchema = z.object({
  categoryId: z.string().min(1).max(40).nullable(),
  amountLimit: z.number().positive().max(999_999_999_999),
  period: z.enum(['weekly', 'monthly', 'yearly']),
  alertPercent: z.number().int().min(1).max(100),
  createdAt: z.iso.datetime(),
});

class OpError extends Error {}

async function findOwned(conn, table, id, userId) {
  const [rows] = await conn.query(
    `SELECT user_id, deleted, client_updated_at FROM ${table} WHERE id = ? FOR UPDATE`,
    [id],
  );
  const row = rows[0];
  if (row && row.user_id !== userId) throw new OpError('El registro pertenece a otro usuario');
  return row;
}

async function upsertTransaction(conn, userId, op) {
  const parsed = transactionSchema.safeParse(op.payload ?? {});
  if (!parsed.success) throw new OpError('Movimiento inválido: ' + parsed.error.issues[0].message);
  const t = parsed.data;

  const [cats] = await conn.query('SELECT type FROM categories WHERE id = ?', [t.categoryId]);
  if (!cats.length) throw new OpError('Categoría inexistente');
  if (cats[0].type !== t.type) throw new OpError('La categoría no corresponde al tipo de movimiento');

  const updatedAt = new Date(op.updatedAt);
  const existing = await findOwned(conn, 'transactions', op.entityId, userId);
  if (existing && (existing.deleted || existing.client_updated_at > updatedAt)) return 'stale';

  await conn.query(
    `INSERT INTO transactions
       (id, user_id, category_id, type, amount, date, description, payment_method, merchant, client_updated_at, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE
       category_id = VALUES(category_id), type = VALUES(type), amount = VALUES(amount), date = VALUES(date),
       description = VALUES(description), payment_method = VALUES(payment_method), merchant = VALUES(merchant),
       client_updated_at = VALUES(client_updated_at), server_updated_at = NOW(3)`,
    [op.entityId, userId, t.categoryId, t.type, t.amount, t.date, t.description, t.paymentMethod, t.merchant, updatedAt],
  );
  return 'ok';
}

async function upsertBudget(conn, userId, op) {
  const parsed = budgetSchema.safeParse(op.payload ?? {});
  if (!parsed.success) throw new OpError('Presupuesto inválido: ' + parsed.error.issues[0].message);
  const b = parsed.data;

  if (b.categoryId) {
    const [cats] = await conn.query('SELECT type FROM categories WHERE id = ?', [b.categoryId]);
    if (!cats.length || cats[0].type !== 'expense') throw new OpError('Categoría de gasto inválida');
  }

  const updatedAt = new Date(op.updatedAt);
  const existing = await findOwned(conn, 'budgets', op.entityId, userId);
  if (existing && (existing.deleted || existing.client_updated_at > updatedAt)) return 'stale';

  await conn.query(
    `INSERT INTO budgets
       (id, user_id, category_id, amount_limit, period, alert_percent, client_created_at, client_updated_at, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE
       category_id = VALUES(category_id), amount_limit = VALUES(amount_limit), period = VALUES(period),
       alert_percent = VALUES(alert_percent), client_updated_at = VALUES(client_updated_at), server_updated_at = NOW(3)`,
    [op.entityId, userId, b.categoryId, b.amountLimit, b.period, b.alertPercent, new Date(b.createdAt), updatedAt],
  );
  return 'ok';
}

const TABLES = { transaction: 'transactions', budget: 'budgets', receipt: 'receipts' };

/** Rutas de las facturas activas que quedan huérfanas al eliminar este registro. */
async function receiptFilesOf(conn, op) {
  if (op.entity === 'budget') return [];
  const column = op.entity === 'transaction' ? 'transaction_id' : 'id';
  const [rows] = await conn.query(`SELECT file_path FROM receipts WHERE ${column} = ? AND deleted = 0`, [op.entityId]);
  return rows.map((r) => r.file_path);
}

async function softDelete(conn, userId, op, orphanFiles) {
  const table = TABLES[op.entity];
  const existing = await findOwned(conn, table, op.entityId, userId);
  if (!existing || existing.deleted) return 'ok';
  orphanFiles.push(...(await receiptFilesOf(conn, op)));
  await conn.query(`UPDATE ${table} SET deleted = 1, server_updated_at = NOW(3) WHERE id = ?`, [op.entityId]);
  if (op.entity === 'transaction') {
    await conn.query('UPDATE receipts SET deleted = 1, server_updated_at = NOW(3) WHERE transaction_id = ? AND deleted = 0', [
      op.entityId,
    ]);
  }
  return 'ok';
}

/** Busca una operación ya procesada (idempotencia). Exportada para reutilizarla en receipts.js. */
export async function findProcessed(conn, opId, userId) {
  const [rows] = await conn.query('SELECT user_id, result FROM processed_operations WHERE op_id = ?', [opId]);
  if (!rows.length) return null;
  if (rows[0].user_id !== userId) throw new OpError('opId en uso por otro usuario');
  const result = rows[0].result;
  return typeof result === 'string' ? JSON.parse(result) : result;
}

export async function recordProcessed(conn, userId, op, result) {
  await conn.query('INSERT INTO processed_operations (op_id, user_id, entity, action, result) VALUES (?, ?, ?, ?, ?)', [
    op.opId, userId, op.entity, op.action, JSON.stringify(result),
  ]);
}

async function applyOperation(userId, op) {
  const orphanFiles = [];
  const result = await withTransaction(async (conn) => {
    const previous = await findProcessed(conn, op.opId, userId);
    if (previous) return { ...previous, duplicate: true };

    let status;
    if (op.action === 'delete') status = await softDelete(conn, userId, op, orphanFiles);
    else if (op.entity === 'transaction') status = await upsertTransaction(conn, userId, op);
    else if (op.entity === 'budget') status = await upsertBudget(conn, userId, op);
    else throw new OpError('Las facturas se suben con POST /api/receipts');

    const out = { opId: op.opId, status };
    await recordProcessed(conn, userId, op, out);
    return out;
  });
  // Los archivos se borran solo después del COMMIT: si la transacción falla, siguen en su sitio.
  if (orphanFiles.length) await removeUploads(orphanFiles);
  return result;
}

router.post('/push', async (req, res) => {
  const operations = Array.isArray(req.body?.operations) ? req.body.operations : null;
  if (!operations || operations.length > 100) {
    return res.status(400).json({ error: 'Se espera { operations: [...] } con máximo 100 elementos' });
  }

  const results = [];
  for (const raw of operations) {
    const envelope = envelopeSchema.safeParse(raw);
    if (!envelope.success) {
      results.push({ opId: raw?.opId ?? null, status: 'error', error: 'Operación mal formada' });
      continue;
    }
    try {
      results.push(await applyOperation(req.user.id, envelope.data));
    } catch (err) {
      if (!(err instanceof OpError)) throw err;
      results.push({ opId: envelope.data.opId, status: 'error', error: err.message });
    }
  }
  res.json({ results });
});

const toIso = (d) => (d instanceof Date ? d.toISOString() : d);

router.get('/pull', async (req, res) => {
  const serverTime = new Date();
  const sinceParam = req.query.since ? new Date(String(req.query.since)) : null;
  // Margen de 5 s para no perder cambios confirmados justo durante la consulta anterior.
  const since = sinceParam && !Number.isNaN(sinceParam.getTime()) ? new Date(sinceParam.getTime() - 5000) : new Date(0);
  const userId = req.user.id;

  const [[transactions], [budgets], [receipts]] = await Promise.all([
    pool.query(
      `SELECT id, category_id, type, amount, date, description, payment_method, merchant, deleted, client_updated_at
       FROM transactions WHERE user_id = ? AND server_updated_at > ?`,
      [userId, since],
    ),
    pool.query(
      `SELECT id, category_id, amount_limit, period, alert_percent, deleted, client_created_at, client_updated_at
       FROM budgets WHERE user_id = ? AND server_updated_at > ?`,
      [userId, since],
    ),
    pool.query(
      `SELECT id, transaction_id, mime_type, size_bytes, file_hash, description, captured_at, deleted, client_updated_at
       FROM receipts WHERE user_id = ? AND server_updated_at > ?`,
      [userId, since],
    ),
  ]);

  res.json({
    serverTime: serverTime.toISOString(),
    transactions: transactions.map((t) => ({
      id: t.id,
      categoryId: t.category_id,
      type: t.type,
      amount: Number(t.amount),
      date: t.date,
      description: t.description ?? '',
      paymentMethod: t.payment_method ?? '',
      merchant: t.merchant ?? '',
      deleted: !!t.deleted,
      updatedAt: toIso(t.client_updated_at),
    })),
    budgets: budgets.map((b) => ({
      id: b.id,
      categoryId: b.category_id,
      amountLimit: Number(b.amount_limit),
      period: b.period,
      alertPercent: b.alert_percent,
      deleted: !!b.deleted,
      createdAt: toIso(b.client_created_at),
      updatedAt: toIso(b.client_updated_at),
    })),
    receipts: receipts.map((r) => ({
      id: r.id,
      transactionId: r.transaction_id,
      mimeType: r.mime_type,
      size: r.size_bytes,
      hash: r.file_hash,
      description: r.description ?? '',
      capturedAt: toIso(r.captured_at),
      deleted: !!r.deleted,
      updatedAt: toIso(r.client_updated_at),
    })),
  });
});

export default router;
