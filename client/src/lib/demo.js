import { importRecords } from './repo.js';
import { toDateKey } from './util.js';

/**
 * Datos de demostración realistas (4 meses) para presentar la app.
 * Se guardan como cualquier otro registro: entran a la cola y se sincronizan.
 */

// Pseudoaleatorio con semilla: los mismos datos en cada demostración
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const round = (n, step = 1000) => Math.round(n / step) * step;

export function buildDemoData(today = new Date()) {
  const rand = rng(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => round(a + rand() * (b - a));
  const tx = [];
  const add = (date, type, categoryId, amount, description, merchant = '', paymentMethod = 'debit') => {
    if (date > today) return;
    tx.push({ type, categoryId, amount, date: toDateKey(date), description, merchant, paymentMethod });
  };

  for (let m = 3; m >= 0; m--) {
    const first = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const day = (d) => new Date(first.getFullYear(), first.getMonth(), d);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

    add(day(1), 'income', 'salary', 3800000, 'Salario', 'Empresa', 'transfer');
    if (rand() > 0.4) add(day(12 + Math.floor(rand() * 8)), 'income', 'freelance', between(400000, 900000), 'Proyecto de diseño web', 'Cliente', 'transfer');
    add(day(2), 'expense', 'housing', 1250000, 'Arriendo', 'Inmobiliaria', 'transfer');
    add(day(5), 'expense', 'utilities', between(150000, 210000), 'Energía y agua', 'Empresas públicas');
    add(day(6), 'expense', 'utilities', 89900, 'Internet hogar', 'Proveedor de internet');
    add(day(8), 'expense', 'education', 65000, 'Curso en línea', 'Plataforma de cursos', 'credit');

    for (let d = 1; d <= daysInMonth; d++) {
      const date = day(d);
      const weekday = date.getDay();
      if (weekday >= 1 && weekday <= 5) add(date, 'expense', 'transport', pick([5800, 5800, 11600]), 'Pasajes', 'Transporte público', 'cash');
      if (weekday === 6) add(date, 'expense', 'food', between(140000, 260000), 'Mercado semanal', pick(['Supermercado Central', 'Mercado La Esquina', 'Tienda Don Pedro']));
      if (rand() < 0.22) add(date, 'expense', 'food', between(14000, 38000), pick(['Almuerzo', 'Café y pan', 'Domicilio']), pick(['Restaurante El Fogón', 'Café Aroma', 'App de domicilios']), 'credit');
      if (rand() < 0.07) add(date, 'expense', 'entertainment', between(25000, 90000), pick(['Cine', 'Concierto', 'Salida con amigos']), pick(['Cine Colombia', 'Bar La Terraza', 'Teatro Municipal']), 'credit');
      if (rand() < 0.04) add(date, 'expense', 'shopping', between(60000, 220000), pick(['Ropa', 'Audífonos', 'Regalo']), pick(['Almacén Moda', 'Tienda Tech', 'Centro comercial']), 'credit');
      if (rand() < 0.03) add(date, 'expense', 'health', between(20000, 95000), pick(['Farmacia', 'Consulta']), pick(['Droguería Salud', 'Clínica']));
    }
    add(day(15), 'expense', 'entertainment', 26900, 'Suscripción de streaming', 'Streaming', 'credit');
  }

  const createdAt = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString();
  const budgets = [
    { categoryId: 'food', amountLimit: 1000000, period: 'monthly', alertPercent: 80, createdAt },
    { categoryId: 'entertainment', amountLimit: 200000, period: 'monthly', alertPercent: 75, createdAt },
    { categoryId: 'transport', amountLimit: 70000, period: 'weekly', alertPercent: 80, createdAt },
    { categoryId: null, amountLimit: 3600000, period: 'monthly', alertPercent: 90, createdAt },
  ];
  return { transactions: tx, budgets };
}

export async function loadDemoData() {
  const { transactions, budgets } = buildDemoData();
  await importRecords(transactions, budgets);
  return transactions.length;
}
