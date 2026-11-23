import { db, getMeta, setMeta } from './db.js';
import { notify } from './notify.js';
import { money, toDateKey } from './util.js';

export const PERIOD_LABELS = { weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' };

/**
 * Rango del período que contiene `ref` (offset = -1 para el anterior, etc.).
 * Los presupuestos se "reinician" solos: el gasto se calcula siempre dentro del período vigente.
 */
export function periodRange(period, ref = new Date(), offset = 0) {
  let start;
  let end;
  if (period === 'weekly') {
    const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ((ref.getDay() + 6) % 7) + offset * 7);
    start = monday;
    end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  } else if (period === 'yearly') {
    start = new Date(ref.getFullYear() + offset, 0, 1);
    end = new Date(ref.getFullYear() + offset, 11, 31);
  } else {
    start = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
    end = new Date(ref.getFullYear(), ref.getMonth() + offset + 1, 0);
  }
  const startKey = toDateKey(start);
  return { start: startKey, end: toDateKey(end), key: `${period}:${startKey}` };
}

export function spentIn(budget, transactions, range) {
  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.date >= range.start &&
        t.date <= range.end &&
        (!budget.categoryId || t.categoryId === budget.categoryId),
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

/** level: 'ok' | 'warning' (≥ % de alerta) | 'exceeded' (≥ 100 %) */
export function budgetStatus(budget, transactions, ref = new Date()) {
  const range = periodRange(budget.period, ref);
  const spent = spentIn(budget, transactions, range);
  const pct = budget.amountLimit > 0 ? (spent / budget.amountLimit) * 100 : 0;
  const level = pct >= 100 ? 'exceeded' : pct >= budget.alertPercent ? 'warning' : 'ok';
  return { range, spent, pct, remaining: budget.amountLimit - spent, level };
}

/** Historial de períodos cerrados: cumplido o excedido. */
export function budgetHistory(budget, transactions, count = 6) {
  const created = budget.createdAt ? toDateKey(new Date(budget.createdAt)) : '0000-00-00';
  const rows = [];
  for (let i = 1; i <= count; i++) {
    const range = periodRange(budget.period, new Date(), -i);
    if (range.end < created) break;
    const spent = spentIn(budget, transactions, range);
    rows.push({ ...range, spent, exceeded: spent > budget.amountLimit });
  }
  return rows;
}

export function budgetName(budget, categoriesById) {
  if (!budget.categoryId) return 'Todos los gastos';
  const c = categoriesById[budget.categoryId];
  return c ? c.name : budget.categoryId;
}

let checking = false;

/**
 * Revisa los presupuestos y avisa una sola vez por umbral y período.
 * Funciona 100 % en local, sin servidor (requisito del documento).
 */
export async function checkBudgetAlerts() {
  if (checking) return;
  checking = true;
  try {
    const [budgets, transactions, categories] = await Promise.all([
      db.budgets.toArray(),
      db.transactions.toArray(),
      db.categories.toArray(),
    ]);
    const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
    const fired = new Set(await getMeta('firedAlerts', []));
    let changed = false;

    for (const b of budgets) {
      const s = budgetStatus(b, transactions);
      const name = budgetName(b, byId);
      const thresholds = [
        [100, `Presupuesto superado: ${name}`, `Llevas ${money(s.spent)} de ${money(b.amountLimit)} (${Math.round(s.pct)} %).`],
        [b.alertPercent, `Presupuesto al ${b.alertPercent} %: ${name}`, `Te quedan ${money(s.remaining)} en este período.`],
      ];
      for (const [threshold, title, body] of thresholds) {
        const key = `${b.id}:${s.range.key}:${threshold}`;
        if (s.pct >= threshold && !fired.has(key)) {
          fired.add(key);
          changed = true;
          notify(title, body, threshold >= 100 ? 'error' : 'warning');
          break; // si ya pasó el 100 %, no se avisa además el 80 %
        }
      }
      // Marcar el umbral inferior como avisado si ya se superó el 100 %
      if (s.pct >= 100) fired.add(`${b.id}:${s.range.key}:${b.alertPercent}`);
    }
    if (changed) await setMeta('firedAlerts', [...fired].slice(-500));
  } finally {
    checking = false;
  }
}

