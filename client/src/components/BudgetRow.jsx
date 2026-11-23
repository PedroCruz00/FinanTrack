import { PERIOD_LABELS } from '../lib/budgets.js';
import { money } from '../lib/util.js';
import Icon, { CategoryIcon } from './Icon.jsx';

const LEVEL = {
  ok: ['check', 'En control'],
  warning: ['alert', 'Cerca del límite'],
  exceeded: ['alert', 'Superado'],
};

/** Anillo de progreso con el ícono de la categoría al centro. */
function Ring({ pct, categoryId, level }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const shown = Math.min(pct, 100);
  return (
    <span className={`ring level-${level}`}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} className="ring-track" />
        <circle
          cx="24"
          cy="24"
          r={r}
          className="ring-fill"
          strokeDasharray={`${(shown / 100) * circ} ${circ}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="ring-icon">
        {categoryId ? <CategoryIcon id={categoryId} size={18} /> : <Icon name="target" size={18} />}
      </span>
    </span>
  );
}

export default function BudgetRow({ name, budget, status, detailed = false, onClick }) {
  const [icon, label] = LEVEL[status.level];
  const pct = Math.round(status.pct);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`budget-row level-${status.level}`} onClick={onClick}>
      <Ring pct={status.pct} categoryId={budget.categoryId} level={status.level} />
      <span className="budget-main">
        <span className="budget-name">{name}</span>
        <span className="budget-meta">
          {status.remaining >= 0 ? `Quedan ${money(status.remaining)}` : `Excedido por ${money(-status.remaining)}`}
        </span>
        {detailed && (
          <span className="budget-meta">
            {money(status.spent)} de {money(budget.amountLimit)} · {PERIOD_LABELS[budget.period].toLowerCase()}
          </span>
        )}
        {(detailed || status.level !== 'ok') && (
          <span className={`level-chip level-${status.level}`}>
            <Icon name={icon} size={12} /> {label}
          </span>
        )}
      </span>
      <span className="budget-pct" aria-label={`${pct} % usado`}>
        {pct}
        <small>%</small>
      </span>
    </Tag>
  );
}
