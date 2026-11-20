import Dexie from 'dexie';

/**
 * Base de datos local (IndexedDB). Es la fuente de verdad de la interfaz:
 * la app siempre lee y escribe aquí, y el motor de sincronización se encarga del servidor.
 * La comparten la página y el service worker.
 *
 * syncStatus de cada registro: 'pending' | 'syncing' | 'synced' | 'error'
 */
export const db = new Dexie('finantrack');

db.version(1).stores({
  transactions: 'id, date, type, categoryId, syncStatus',
  budgets: 'id, categoryId, syncStatus',
  receipts: 'id, transactionId, syncStatus', // incluye el Blob de la imagen comprimida
  categories: 'id, type',
  // Cola de operaciones pendientes (COLA_SINCRONIZACION del documento)
  outbox: '++seq, opId, entityId, status',
  meta: 'key',
});

// v2: bandeja de imágenes recibidas con "Compartir" desde otra app (Web Share Target)
db.version(2).stores({
  shared: '++id',
});

export const tableFor = {
  transaction: db.transactions,
  budget: db.budgets,
  receipt: db.receipts,
};

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}

export function setMeta(key, value) {
  return db.meta.put({ key, value });
}

export async function clearLocalData() {
  await db.transaction('rw', db.tables, () => Promise.all(db.tables.map((t) => t.clear())));
}
