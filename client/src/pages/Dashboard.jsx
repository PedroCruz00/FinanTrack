import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBudgets, useCategories, useOutbox, useTransactions } from '../lib/hooks.js';
import { budgetName, budgetStatus } from '../lib/budgets.js';
import { formatMonthLong, money, toDateKey } from '../lib/util.js';
import { useAuth } from '../lib/auth.jsx';
import BudgetRow from '../components/BudgetRow.jsx';
import TransactionRow from '../components/TransactionRow.jsx';
import Icon, { CategoryIcon } from '../components/Icon.jsx';
import CoachCard from '../components/CoachCard.jsx';
import InstallCard from '../components/InstallCard.jsx';
import { coachMessage } from '../lib/coach.js';
import { useSyncState } from '../lib/sync.js';

const SCOPES = [
  ['day', 'Hoy'],
  ['month', 'Mes'],
  ['year', 'Año'],
];

function inScope(date, scope) {
  const today = toDateKey();
  if (scope === 'day') return date === today;
  if (scope === 'month') return date.slice(0, 7) === today.slice(0, 7);
  return date.slice(0, 4) === today.slice(0, 4);
}

function scopeLabel(scope) {
  const today = toDateKey();
  if (scope === 'day') return 'Balance de hoy';
  if (scope === 'month') return `Balance de ${formatMonthLong(today.slice(0, 7)).split(' ')[0]}`;
  return `Balance de ${today.slice(0, 4)}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard() {
  const { user } = useAuth();
  const transactions = useTransactions();
  const budgets = useBudgets();
  const outbox = useOutbox();
  const { byId } = useCategories();
  const [scope, setScope] = useState('month');
  const { online } = useSyncState();
  const coach = useMemo(
    () => coachMessage({ transactions, budgets, byId, online, outbox }),
    [transactions, budgets, byId, online, outbox],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (!inScope(t.date, scope)) continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [transactions, scope]);

  const byCategory = useMemo(() => {
    const sums = {};
    for (const t of transactions) {
      if (t.type === 'expense' && inScope(t.date, scope)) sums[t.categoryId] = (sums[t.categoryId] ?? 0) + t.amount;
    }
    return Object.entries(sums).sort((a, b) => b[1] - a[1]);
  }, [transactions, scope]);

  const pendingReceipts = outbox.filter((o) => o.entity === 'receipt' && o.action === 'upsert').length;
  const maxCat = byCategory[0]?.[1] ?? 0;
  const topBudgets = budgets
    .map((b) => ({ b, s: budgetStatus(b, transactions) }))
    .sort((x, y) => y.s.pct - x.s.pct)
    .slice(0, 3);

  return (
    <div className="page">
      <p className="greeting">
        {greeting()}, <strong>{user?.name?.split(' ')[0]}</strong>
      </p>

      <CoachCard message={coach} />

      <section className="hero">
        <div className="tabs" role="tablist" aria-label="Período">
          {SCOPES.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={scope === k} className={scope === k ? 'active' : ''} onClick={() => setScope(k)}>
              {label}
            </button>
          ))}
        </div>
        <p className="hero-label">{scopeLabel(scope)}</p>
        <p className={`hero-amount ${totals.balance < 0 ? 'negative' : ''}`}>{money(totals.balance)}</p>
        <div className="hero-split">
          <span>
            <span className="flow-icon income">
              <Icon name="arrowDown" size={14} />
            </span>
            <span>
              <small>Ingresos</small>
              {money(totals.income)}
            </span>
          </span>
          <span>
            <span className="flow-icon expense">
              <Icon name="arrowUp" size={14} />
            </span>
            <span>
              <small>Gastos</small>
              {money(totals.expense)}
            </span>
          </span>
        </div>
      </section>

      <InstallCard />

      {pendingReceipts > 0 && (
        <Link to="/sync" className="notice">
          <Icon name="clip" size={18} />
          <span>
            {pendingReceipts} factura{pendingReceipts > 1 ? 's' : ''} en el dispositivo, pendiente{pendingReceipts > 1 ? 's' : ''} de subir
          </span>
          <Icon name="chevronRight" size={16} />
        </Link>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Presupuestos</h2>
          <Link to="/budgets" className="btn-text">
            Ver todos
          </Link>
        </div>
        {topBudgets.length === 0 ? (
          <Link to="/budgets" className="empty-cta">
            <Icon name="target" size={22} />
            <span>
              <strong>Pon un límite a tus gastos</strong>
              <small>Te avisaremos al acercarte y al superarlo.</small>
            </span>
          </Link>
        ) : (
          <div className="stack">
            {topBudgets.map(({ b, s }) => (
              <BudgetRow key={b.id} name={budgetName(b, byId)} budget={b} status={s} />
            ))}
          </div>
        )}
      </section>

      {byCategory.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>En qué se va tu dinero</h2>
            <Link to="/reports" className="btn-text">
              Reportes
            </Link>
          </div>
          <ul className="hbars">
            {byCategory.slice(0, 5).map(([id, sum]) => (
              <li key={id}>
                <span className="hbar-label">
                  <CategoryIcon id={id} size={16} />
                  {byId[id]?.name ?? id}
                </span>
                <span className="hbar-value">{money(sum)}</span>
                <span className="hbar-track">
                  <span className="hbar-fill" style={{ width: `${(sum / maxCat) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Recientes</h2>
          {transactions.length > 0 && (
            <Link to="/transactions" className="btn-text">
              Ver historial
            </Link>
          )}
        </div>
        {transactions.length === 0 ? (
          <Link to="/transactions/new" className="empty-cta">
            <Icon name="plus" size={22} />
            <span>
              <strong>Registra tu primer movimiento</strong>
              <small>Funciona incluso sin conexión.</small>
            </span>
          </Link>
        ) : (
          <ul className="tx-list">
            {transactions.slice(0, 5).map((t) => (
              <TransactionRow key={t.id} t={t} category={byId[t.categoryId]} showDate />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
