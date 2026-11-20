import { db } from './db.js';
import { compressImage, sha256Hex } from './image.js';
import { requestSync } from './sync.js';
import { checkBudgetAlerts } from './budgets.js';
import { nowIso, uuid } from './util.js';

/**
 * Repositorio local. Cada escritura hace dos cosas en UNA transacción de IndexedDB:
 *   1. guarda el registro con syncStatus = 'pending'
 *   2. añade una operación a la cola (outbox)
 * Así nunca queda un cambio guardado sin su operación de sincronización, ni al revés.
 */

async function enqueue({ entity, action, entityId, payload = null, updatedAt }) {
  if (action === 'upsert') {
    // Si ya hay un upsert pendiente del mismo registro, lo reemplazamos (no se envían versiones intermedias).
    // Se genera un opId nuevo porque el contenido cambió.
    const pending = await db.outbox
      .where('entityId')
      .equals(entityId)
      .filter((o) => o.status === 'pending' && o.action === 'upsert' && o.entity === entity)
      .first();
    if (pending) {
      await db.outbox.update(pending.seq, { opId: uuid(), payload, updatedAt, attempts: 0, nextAttemptAt: 0 });
      return;
    }
  }
  await db.outbox.add({
    opId: uuid(),
    entity,
    action,
    entityId,
    payload,
    updatedAt,
    status: 'pending', // pending | syncing | error
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    createdAt: nowIso(),
  });
}

function afterWrite() {
  requestSync();
}

// ---------- Movimientos ----------

export async function saveTransaction(input, id = uuid()) {
  const updatedAt = nowIso();
  const payload = {
    type: input.type,
    categoryId: input.categoryId,
    amount: Number(input.amount),
    date: input.date,
    description: input.description?.trim() ?? '',
    paymentMethod: input.paymentMethod ?? '',
    merchant: input.merchant?.trim() ?? '',
  };
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.put({ id, ...payload, updatedAt, syncStatus: 'pending' });
    await enqueue({ entity: 'transaction', action: 'upsert', entityId: id, payload, updatedAt });
  });
  afterWrite();
  if (payload.type === 'expense') checkBudgetAlerts();
  return id;
}

export async function deleteTransaction(id) {
  await db.transaction('rw', db.transactions, db.receipts, db.outbox, async () => {
    const receiptIds = await db.receipts.where('transactionId').equals(id).primaryKeys();
    // Las fotos pendientes de subir ya no hacen falta: el servidor borra en cascada las que tenga.
    await db.outbox.where('entityId').anyOf(receiptIds).filter((o) => o.status !== 'syncing').delete();
    await db.receipts.bulkDelete(receiptIds);
    await db.transactions.delete(id);
    await enqueue({ entity: 'transaction', action: 'delete', entityId: id, updatedAt: nowIso() });
  });
  afterWrite();
}

// ---------- Facturas ----------

export async function addReceipts(transactionId, files, description = '') {
  const prepared = [];
  for (const file of files) {
    const blob = await compressImage(file);
    prepared.push({ blob, hash: await sha256Hex(blob) });
  }
  const now = nowIso();
  await db.transaction('rw', db.receipts, db.outbox, async () => {
    for (const { blob, hash } of prepared) {
      const id = uuid();
      const receipt = {
        id,
        transactionId,
        blob,
        mimeType: blob.type,
        size: blob.size,
        hash,
        description,
        capturedAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      };
      await db.receipts.put(receipt);
      // El Blob no va en la cola: el motor de sync lo lee de la tabla receipts al subirlo.
      await enqueue({
        entity: 'receipt',
        action: 'upsert',
        entityId: id,
        payload: { transactionId, capturedAt: now, description, hash },
        updatedAt: now,
      });
    }
  });
  afterWrite();
  return prepared.reduce((s, p) => s + p.blob.size, 0);
}

export async function deleteReceipt(id) {
  await db.transaction('rw', db.receipts, db.outbox, async () => {
    await db.outbox.where('entityId').equals(id).filter((o) => o.status !== 'syncing').delete();
    await db.receipts.delete(id);
    await enqueue({ entity: 'receipt', action: 'delete', entityId: id, updatedAt: nowIso() });
  });
  afterWrite();
}

// ---------- Presupuestos ----------

export async function saveBudget(input, existing) {
  const id = existing?.id ?? uuid();
  const updatedAt = nowIso();
  const payload = {
    categoryId: input.categoryId || null,
    amountLimit: Number(input.amountLimit),
    period: input.period,
    alertPercent: Number(input.alertPercent),
    createdAt: existing?.createdAt ?? updatedAt,
  };
  await db.transaction('rw', db.budgets, db.outbox, async () => {
    await db.budgets.put({ id, ...payload, updatedAt, syncStatus: 'pending' });
    await enqueue({ entity: 'budget', action: 'upsert', entityId: id, payload, updatedAt });
  });
  afterWrite();
  checkBudgetAlerts();
  return id;
}

export async function deleteBudget(id) {
  await db.transaction('rw', db.budgets, db.outbox, async () => {
    await db.budgets.delete(id);
    await enqueue({ entity: 'budget', action: 'delete', entityId: id, updatedAt: nowIso() });
  });
  afterWrite();
}

// ---------- Importación masiva (datos de demostración) ----------

export async function importRecords(transactions, budgets = []) {
  const now = nowIso();
  await db.transaction('rw', db.transactions, db.budgets, db.outbox, async () => {
    for (const t of transactions) {
      const id = uuid();
      await db.transactions.put({ id, ...t, updatedAt: now, syncStatus: 'pending' });
      await enqueue({ entity: 'transaction', action: 'upsert', entityId: id, payload: t, updatedAt: now });
    }
    for (const b of budgets) {
      const id = uuid();
      await db.budgets.put({ id, ...b, updatedAt: now, syncStatus: 'pending' });
      await enqueue({ entity: 'budget', action: 'upsert', entityId: id, payload: b, updatedAt: now });
    }
  });
  afterWrite();
}
