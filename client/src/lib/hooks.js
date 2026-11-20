import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.js';

const EMPTY = [];

/** Consultas reactivas: la UI se actualiza sola cuando cambia IndexedDB (incluido tras un sync). */
export function useCategories() {
  const list = useLiveQuery(async () => (await db.categories.toArray()).sort((a, b) => a.order - b.order), [], EMPTY);
  const byId = useMemo(() => Object.fromEntries(list.map((c) => [c.id, c])), [list]);
  return { list, byId };
}

export const useTransactions = () => useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [], EMPTY);

export const useBudgets = () => useLiveQuery(() => db.budgets.toArray(), [], EMPTY);

export const useOutbox = () => useLiveQuery(() => db.outbox.orderBy('seq').toArray(), [], EMPTY);

/** Número de facturas por movimiento (sin cargar los Blobs). */
export function useReceiptCounts() {
  return useLiveQuery(
    async () => {
      const counts = {};
      await db.receipts.each((r) => {
        counts[r.transactionId] = (counts[r.transactionId] ?? 0) + 1;
      });
      return counts;
    },
    [],
    {},
  );
}
