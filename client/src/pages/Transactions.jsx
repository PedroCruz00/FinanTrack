import { useMemo, useState } from 'react';
import { useCategories, useReceiptCounts, useTransactions } from '../lib/hooks.js';
import { dayLabel, money } from '../lib/util.js';
import TransactionRow from '../components/TransactionRow.jsx';
import Icon from '../components/Icon.jsx';
import Brote from '../components/Brote.jsx';

const EMPTY_FILTERS = { q: '', type: '', categoryId: '', from: '', to: '', withReceipts: false };
const TYPES = [
  ['', 'Todos'],
  ['expense', 'Gastos'],
  ['income', 'Ingresos'],
];

const normalize = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function Transactions() {
  const transactions = useTransactions();
  const receiptCounts = useReceiptCounts();
  const { list: categories, byId } = useCategories();
  const [f, setF] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const filtered = useMemo(() => {
    const words = normalize(f.q).split(/\s+/).filter(Boolean);
    return transactions.filter((t) => {
      if (f.type && t.type !== f.type) return false;
      if (f.categoryId && t.categoryId !== f.categoryId) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.withReceipts && !receiptCounts[t.id]) return false;
      if (words.length) {
        // Búsqueda por palabras clave en descripción, establecimiento, categoría y valor
        const hay = normalize(`${t.description} ${t.merchant} ${byId[t.categoryId]?.name ?? ''} ${t.amount}`);
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [transactions, f, byId, receiptCounts]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, { items: [], net: 0 });
      const g = map.get(t.date);
      g.items.push(t);
      g.net += t.type === 'income' ? t.amount : -t.amount;
    }
    return [...map.entries()];
  }, [filtered]);

  const totals = filtered.reduce((acc, t) => ((acc[t.type] += t.amount), acc), { income: 0, expense: 0 });
  const activeCount = [f.type, f.categoryId, f.from, f.to, f.withReceipts].filter(Boolean).length;

  return (
    <div className="page">
      <h1 className="page-title">Movimientos</h1>

      <div className="searchbar">
        <label className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Buscar compra, lugar o valor" value={f.q} onChange={set('q')} aria-label="Buscar" />
        </label>
        <button
          className={`icon-btn ${showFilters || activeCount ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-label="Filtros"
        >
          <Icon name="sliders" size={20} />
          {activeCount > 0 && <span className="dot-count">{activeCount}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="filters">
          <div className="pills" role="radiogroup" aria-label="Tipo">
            {TYPES.map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={f.type === k}
                className={`pill ${f.type === k ? 'active' : ''}`}
                onClick={() => setF({ ...f, type: k, categoryId: '' })}
              >
                {label}
              </button>
            ))}
          </div>
          <select value={f.categoryId} onChange={set('categoryId')} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {categories
              .filter((c) => !f.type || c.type === f.type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <div className="field-row">
            <label className="field">
              <span>Desde</span>
              <input type="date" value={f.from} onChange={set('from')} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={f.to} onChange={set('to')} />
            </label>
          </div>
          <div className="filters-foot">
            <label className="switch">
              <input type="checkbox" checked={f.withReceipts} onChange={set('withReceipts')} />
              <span>Solo con factura</span>
            </label>
            {activeCount > 0 && (
              <button className="btn-text" onClick={() => setF({ ...EMPTY_FILTERS, q: f.q })}>
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="summary-line">
          {filtered.length} movimiento{filtered.length > 1 ? 's' : ''}
          <span>
            <span className="positive">+{money(totals.income)}</span> · −{money(totals.expense)}
          </span>
        </p>
      )}

      {groups.length === 0 ? (
        <div className="empty-state">
          <Brote mood={transactions.length ? 'think' : 'wave'} size={120} />
          <p>
            <strong>{transactions.length ? 'No encontré nada' : 'Aún no hay movimientos'}</strong>
            <br />
            {transactions.length ? 'Prueba con otra palabra o quita algunos filtros.' : 'Toca el botón + para registrar el primero.'}
          </p>
        </div>
      ) : (
        groups.map(([date, g]) => (
          <section key={date} className="day-group">
            <h3 className="day-head">
              <span>{dayLabel(date)}</span>
              <span className={g.net >= 0 ? 'positive' : ''}>
                {g.net >= 0 ? '+' : '−'}
                {money(Math.abs(g.net))}
              </span>
            </h3>
            <ul className="tx-list">
              {g.items.map((t) => (
                <TransactionRow key={t.id} t={t} category={byId[t.categoryId]} receipts={receiptCounts[t.id]} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
