import { api, ApiError } from './api.js';
import { db, getMeta, setMeta, tableFor } from './db.js';

/**
 * Núcleo de sincronización — sin React ni DOM.
 * Lo usan la página (lib/sync.js) y el service worker (sw.js, Background Sync con la app cerrada).
 *
 * 1. PUSH: envía la cola en orden. Cada operación lleva un opId único: reenviarla tras un
 *    corte de red no crea duplicados (el servidor es idempotente).
 * 2. PULL: trae los cambios hechos en otros dispositivos desde la última sincronización.
 *
 * Exclusión mutua con Web Locks: nunca corren dos sincronizaciones a la vez
 * (ni entre pestañas ni entre la página y el service worker).
 */

const BATCH_SIZE = 50;
const MAX_RETRYABLE_ATTEMPTS = 8;
const LOCK = 'finantrack-sync';

/** Espera exponencial: 5 s, 10 s, 20 s… hasta 10 min. */
const backoff = (attempts) => Math.min(5000 * 2 ** (attempts - 1), 10 * 60 * 1000);

async function markEntityAfterSuccess(entity, entityId) {
  const remaining = await db.outbox.where('entityId').equals(entityId).count();
  if (remaining === 0) await tableFor[entity].update(entityId, { syncStatus: 'synced' });
}

async function markOpError(op, message) {
  await db.outbox.update(op.seq, { status: 'error', lastError: message, attempts: op.attempts + 1 });
  await tableFor[op.entity].update(op.entityId, { syncStatus: 'error' });
}

async function markOpRetry(op, message) {
  const attempts = op.attempts + 1;
  if (attempts >= MAX_RETRYABLE_ATTEMPTS) return markOpError(op, message);
  await db.outbox.update(op.seq, {
    status: 'pending',
    attempts,
    lastError: message,
    nextAttemptAt: Date.now() + backoff(attempts),
  });
  await tableFor[op.entity].update(op.entityId, { syncStatus: 'pending' });
}

async function setSyncing(ops) {
  await db.transaction('rw', db.outbox, db.transactions, db.budgets, db.receipts, async () => {
    for (const op of ops) {
      await db.outbox.update(op.seq, { status: 'syncing' });
      await tableFor[op.entity].update(op.entityId, { syncStatus: 'syncing' });
    }
  });
}

async function pushBatch(ops) {
  await setSyncing(ops);
  let response;
  try {
    response = await api('/sync/push', {
      method: 'POST',
      json: {
        operations: ops.map(({ opId, entity, action, entityId, payload, updatedAt }) => ({
          opId, entity, action, entityId, payload, updatedAt,
        })),
      },
    });
  } catch (err) {
    for (const op of ops) await markOpRetry(op, err.message);
    throw err;
  }

  let stale = false;
  const byOp = new Map(response.results.map((r) => [r.opId, r]));
  for (const op of ops) {
    const result = byOp.get(op.opId);
    if (result?.status === 'ok' || result?.status === 'stale') {
      stale ||= result.status === 'stale';
      await db.outbox.delete(op.seq);
      await markEntityAfterSuccess(op.entity, op.entityId);
    } else {
      await markOpError(op, result?.error ?? 'Respuesta inesperada del servidor');
    }
  }
  return stale;
}

async function pushReceipt(op) {
  const receipt = await db.receipts.get(op.entityId);
  if (!receipt?.blob) {
    await db.outbox.delete(op.seq); // la factura se eliminó localmente antes de subirse
    return false;
  }
  await setSyncing([op]);

  const form = new FormData();
  form.append('opId', op.opId);
  form.append('id', receipt.id);
  form.append('transactionId', receipt.transactionId);
  form.append('capturedAt', receipt.capturedAt);
  form.append('updatedAt', receipt.updatedAt);
  form.append('description', receipt.description ?? '');
  form.append('hash', receipt.hash ?? '');
  form.append('file', receipt.blob, `${receipt.id}.jpg`);

  try {
    const result = await api('/receipts', { method: 'POST', formData: form });
    await db.outbox.delete(op.seq);
    await markEntityAfterSuccess('receipt', op.entityId);
    return result.status === 'stale';
  } catch (err) {
    if (!(err instanceof ApiError) || err.isNetwork) {
      await markOpRetry(op, err.message);
      throw err;
    }
    if (err.body?.retryable) await markOpRetry(op, err.message); // p. ej. el movimiento aún no llegó
    else await markOpError(op, err.message);
    return false;
  }
}

export async function pushOutbox({ manual = false } = {}) {
  let stale = false;
  const tried = new Set(); // cada operación se intenta como máximo una vez por pasada
  for (let round = 0; round < 50; round++) {
    const now = Date.now();
    const ops = await db.outbox
      .orderBy('seq')
      .filter((o) => o.status === 'pending' && !tried.has(o.seq) && (manual || o.nextAttemptAt <= now))
      .toArray();
    if (!ops.length) break;

    // Se respeta el orden de la cola: un lote JSON con las operaciones consecutivas
    // que no son subidas de archivo, o una subida de factura individual.
    const first = ops[0];
    if (first.entity === 'receipt' && first.action === 'upsert') {
      tried.add(first.seq);
      stale = (await pushReceipt(first)) || stale;
    } else {
      const batch = [];
      for (const op of ops) {
        if ((op.entity === 'receipt' && op.action === 'upsert') || batch.length === BATCH_SIZE) break;
        batch.push(op);
        tried.add(op.seq);
      }
      stale = (await pushBatch(batch)) || stale;
    }
  }
  return stale;
}

/** ¿Quedan operaciones locales de este registro en la cola? Entonces el servidor no lo sobrescribe. */
const hasLocalChanges = async (id) => (await db.outbox.where('entityId').equals(id).count()) > 0;

export async function pullChanges({ full = false } = {}) {
  if ((await db.categories.count()) === 0) await refreshCategories();

  const since = full ? null : await getMeta('lastPull');
  const data = await api(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`);

  await db.transaction('rw', db.transactions, db.budgets, db.receipts, db.outbox, db.meta, async () => {
    for (const { deleted, ...t } of data.transactions) {
      if (await hasLocalChanges(t.id)) continue;
      if (deleted) {
        await db.transactions.delete(t.id);
        await db.receipts.where('transactionId').equals(t.id).delete();
      } else {
        await db.transactions.put({ ...t, syncStatus: 'synced' });
      }
    }
    for (const { deleted, ...b } of data.budgets) {
      if (await hasLocalChanges(b.id)) continue;
      if (deleted) await db.budgets.delete(b.id);
      else await db.budgets.put({ ...b, syncStatus: 'synced' });
    }
    for (const { deleted, ...r } of data.receipts) {
      if (await hasLocalChanges(r.id)) continue;
      const local = await db.receipts.get(r.id);
      if (deleted) await db.receipts.delete(r.id);
      // La imagen no viaja en el pull: se descarga bajo demanda la primera vez que se abre.
      else await db.receipts.put({ ...r, blob: local?.blob, syncStatus: 'synced' });
    }
    await setMeta('lastPull', data.serverTime);
    await setMeta('lastSyncAt', new Date().toISOString());
  });
}

export async function refreshCategories() {
  const categories = await api('/categories');
  await db.transaction('rw', db.categories, async () => {
    await db.categories.clear();
    await db.categories.bulkPut(categories.map((c, i) => ({ ...c, order: i })));
  });
}

/** Si una sincronización anterior se cortó, sus operaciones vuelven a "pendiente" (reenviar es seguro). */
const resetInFlight = () => db.outbox.where('status').equals('syncing').modify({ status: 'pending' });

/**
 * Un ciclo completo: push + pull, bajo un candado exclusivo.
 * Devuelve 'done', o 'busy' si otra pestaña o el service worker ya está sincronizando.
 */
export async function runSyncCycle({ manual = false } = {}) {
  const run = async () => {
    await resetInFlight();
    const stale = await pushOutbox({ manual });
    // Si el servidor rechazó una versión antigua, se hace un pull completo para adoptar la suya.
    await pullChanges({ full: stale });
    await updateAppBadge();
    return 'done';
  };
  const locks = globalThis.navigator?.locks;
  if (!locks) return run();
  return locks.request(LOCK, { ifAvailable: true }, (lock) => (lock ? run() : 'busy'));
}

/** Insignia en el ícono de la app instalada con el número de cambios pendientes (Badging API). */
export async function updateAppBadge() {
  const nav = globalThis.navigator;
  if (!nav?.setAppBadge) return;
  try {
    const pending = await db.outbox.count();
    if (pending) await nav.setAppBadge(pending);
    else await nav.clearAppBadge();
  } catch {
    /* sin permiso o no instalada */
  }
}
