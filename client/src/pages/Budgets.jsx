import { useCallback, useState } from 'react';
import { useBudgets, useCategories, useTransactions } from '../lib/hooks.js';
import { budgetName, budgetStatus, PERIOD_LABELS } from '../lib/budgets.js';
import { deleteBudget, saveBudget } from '../lib/repo.js';
import { notificationsSupported, requestNotificationPermission } from '../lib/notify.js';
import { toast } from '../lib/events.js';
import { groupDigits, money } from '../lib/util.js';
import BudgetRow from '../components/BudgetRow.jsx';
import Sheet from '../components/Sheet.jsx';
import Icon, { CategoryIcon } from '../components/Icon.jsx';
import Brote from '../components/Brote.jsx';

const EMPTY = { categoryId: '', amountLimit: '', period: 'monthly', alertPercent: 80 };

function NotificationsNotice() {
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  if (perm === 'granted') return null;
  return (
    <div className="notice">
      <Icon name="bell" size={18} />
      <span>
        {perm === 'default'
          ? 'Activa las notificaciones para enterarte aunque no estés en la app.'
          : 'Las alertas se mostrarán dentro de la app.'}
      </span>
      {perm === 'default' && (
        <button className="btn-text" onClick={async () => setPerm(await requestNotificationPermission())}>
          Activar
        </button>
      )}
    </div>
  );
}

export default function Budgets() {
  const budgets = useBudgets();
  const transactions = useTransactions();
  const { list: categories, byId } = useCategories();
  const [editing, setEditing] = useState(null); // null | 'new' | budget
  const [form, setForm] = useState(EMPTY);
  const close = useCallback(() => setEditing(null), []);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  function open(budget) {
    setEditing(budget ?? 'new');
    setForm(
      budget
        ? { categoryId: budget.categoryId ?? '', amountLimit: String(Math.round(budget.amountLimit)), period: budget.period, alertPercent: budget.alertPercent }
        : EMPTY,
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!(Number(form.amountLimit) > 0)) return toast('Escribe el límite', 'error');
    const duplicate = budgets.find(
      (b) => b.id !== editing?.id && (b.categoryId ?? '') === form.categoryId && b.period === form.period,
    );
    if (duplicate) return toast('Ya existe un presupuesto para esa categoría y período', 'error');
    await saveBudget(form, editing === 'new' ? null : editing);
    toast('Presupuesto guardado', 'success');
    close();
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el presupuesto "${budgetName(editing, byId)}"?`)) return;
    await deleteBudget(editing.id);
    toast('Presupuesto eliminado', 'success');
    close();
  }

  const rows = budgets.map((b) => ({ b, s: budgetStatus(b, transactions) })).sort((x, y) => y.s.pct - x.s.pct);
  const totalLimit = rows.filter((r) => r.b.period === 'monthly').reduce((s, r) => s + r.b.amountLimit, 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Presupuestos</h1>
        <button className="btn btn-primary btn-sm" onClick={() => open(null)}>
          <Icon name="plus" size={18} /> Nuevo
        </button>
      </div>

      <NotificationsNotice />

      {rows.length === 0 ? (
        <div className="empty-state">
          <Brote mood="think" size={120} />
          <p>
            <strong>Define tus límites</strong>
            <br />
            Un tope general o por categoría, por ejemplo cuánto gastar al mes en alimentación.
          </p>
          <button className="btn btn-primary" onClick={() => open(null)}>
            Crear presupuesto
          </button>
        </div>
      ) : (
        <>
          {totalLimit > 0 && <p className="summary-line">Límites mensuales · {money(totalLimit)}</p>}
          <div className="stack">
            {rows.map(({ b, s }) => (
              <BudgetRow key={b.id} name={budgetName(b, byId)} budget={b} status={s} detailed onClick={() => open(b)} />
            ))}
          </div>
          <p className="hint center">Toca un presupuesto para editarlo. Se reinician solos al comenzar cada período.</p>
        </>
      )}

      <Sheet open={!!editing} title={editing === 'new' ? 'Nuevo presupuesto' : 'Editar presupuesto'} onClose={close}>
        <form className="sheet-form" onSubmit={submit}>
          <label className="amount small">
            <span className="sr-only">Límite</span>
            <span className="amount-currency">$</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={groupDigits(form.amountLimit)}
              onChange={(e) => setForm({ ...form, amountLimit: e.target.value.replace(/\D/g, '').slice(0, 12) })}
              style={{ width: `${Math.max(1, groupDigits(form.amountLimit).length || 1)}ch` }}
              autoFocus
            />
          </label>

          <div className="block">
            <span className="block-label">Aplica a</span>
            <div className="pills wrap">
              <button
                type="button"
                className={`pill ${form.categoryId === '' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, categoryId: '' })}
              >
                <Icon name="target" size={15} /> Todo
              </button>
              {expenseCategories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`pill ${form.categoryId === c.id ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, categoryId: c.id })}
                >
                  <CategoryIcon id={c.id} size={15} /> {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="block">
            <span className="block-label">Período</span>
            <div className="pills">
              {Object.entries(PERIOD_LABELS).map(([k, label]) => (
                <button
                  type="button"
                  key={k}
                  className={`pill ${form.period === k ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, period: k })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block-label">
              Avisarme al <strong>{form.alertPercent} %</strong>
            </span>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={form.alertPercent}
              onChange={(e) => setForm({ ...form, alertPercent: Number(e.target.value) })}
            />
          </label>

          <div className="sheet-actions">
            {editing && editing !== 'new' && (
              <button type="button" className="btn btn-ghost danger" onClick={remove}>
                <Icon name="trash" size={18} /> Eliminar
              </button>
            )}
            <button className="btn btn-primary btn-lg grow">Guardar</button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
