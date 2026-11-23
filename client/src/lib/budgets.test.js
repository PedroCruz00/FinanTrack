import { afterEach, describe, expect, it, vi } from 'vitest';
import { budgetHistory, budgetStatus, periodRange, spentIn } from './budgets.js';

const tx = (date, amount, categoryId = 'food', type = 'expense') => ({ date, amount, categoryId, type });

describe('periodRange', () => {
  it('la semana va de lunes a domingo, también si hoy es domingo', () => {
    expect(periodRange('weekly', new Date(2026, 10, 18))).toMatchObject({ start: '2026-11-16', end: '2026-11-22' });
    expect(periodRange('weekly', new Date(2026, 10, 22))).toMatchObject({ start: '2026-11-16', end: '2026-11-22' });
  });

  it('el mes termina en su último día, incluido febrero bisiesto', () => {
    expect(periodRange('monthly', new Date(2028, 1, 10))).toMatchObject({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('los desplazamientos cruzan el cambio de año', () => {
    expect(periodRange('monthly', new Date(2026, 0, 15), -1)).toMatchObject({ start: '2025-12-01', end: '2025-12-31' });
    expect(periodRange('weekly', new Date(2026, 0, 2), -1)).toMatchObject({ start: '2025-12-22', end: '2025-12-28' });
    expect(periodRange('yearly', new Date(2026, 5, 1), 1)).toMatchObject({ start: '2027-01-01', end: '2027-12-31' });
  });

  it('la clave identifica el período para no repetir alertas', () => {
    expect(periodRange('monthly', new Date(2026, 10, 5)).key).toBe('monthly:2026-11-01');
  });
});

describe('spentIn', () => {
  const range = { start: '2026-11-01', end: '2026-11-30' };
  const list = [
    tx('2026-11-01', 100),
    tx('2026-11-30', 50, 'transport'),
    tx('2026-10-31', 999),
    tx('2026-12-01', 999),
    tx('2026-11-15', 5000, 'salary', 'income'),
  ];

  it('un presupuesto general suma todos los gastos del período, con los extremos incluidos', () => {
    expect(spentIn({ categoryId: null }, list, range)).toBe(150);
  });

  it('un presupuesto por categoría solo suma esa categoría', () => {
    expect(spentIn({ categoryId: 'food' }, list, range)).toBe(100);
  });
});

describe('budgetStatus', () => {
  const ref = new Date(2026, 10, 20);
  const budget = { categoryId: 'food', amountLimit: 1000, period: 'monthly', alertPercent: 80 };

  it.each([
    [500, 'ok', 500],
    [800, 'warning', 200],
    [1000, 'exceeded', 0],
    [1250, 'exceeded', -250],
  ])('con %i gastados el nivel es %s', (spent, level, remaining) => {
    const s = budgetStatus(budget, [tx('2026-11-10', spent)], ref);
    expect(s.level).toBe(level);
    expect(s.remaining).toBe(remaining);
  });

  it('el gasto del mes anterior no cuenta: el presupuesto se reinicia', () => {
    const s = budgetStatus(budget, [tx('2026-10-28', 5000)], ref);
    expect(s.spent).toBe(0);
    expect(s.level).toBe('ok');
  });
});

describe('budgetHistory', () => {
  afterEach(() => vi.useRealTimers());

  it('lista los períodos cerrados desde que se creó el presupuesto', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 20, 12));
    const budget = { categoryId: null, amountLimit: 300, period: 'monthly', createdAt: new Date(2026, 7, 15).toISOString() };
    const rows = budgetHistory(budget, [tx('2026-10-05', 400), tx('2026-09-05', 100)]);

    expect(rows.map((r) => r.start)).toEqual(['2026-10-01', '2026-09-01', '2026-08-01']);
    expect(rows.map((r) => r.exceeded)).toEqual([true, false, false]);
  });
});
