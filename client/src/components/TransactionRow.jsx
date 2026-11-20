import { Link } from 'react-router-dom';
import { dayLabel, money, paymentLabel } from '../lib/util.js';
import Icon, { CategoryIcon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';

const shortFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
function shortDay(key) {
  const label = dayLabel(key);
  if (label === 'Hoy' || label === 'Ayer') return label;
  const [y, m, d] = key.split('-').map(Number);
  return shortFmt.format(new Date(y, m - 1, d)).replace('.', '');
}

export default function TransactionRow({ t, category, receipts = 0, showDate = false }) {
  const title = t.description || t.merchant || category?.name || 'Movimiento';
  // La fecha va primero para que no se corte en pantallas angostas
  const meta = [
    showDate ? shortDay(t.date) : null,
    t.description || t.merchant ? category?.name : null,
    t.merchant && t.description ? t.merchant : null,
    showDate ? null : paymentLabel(t.paymentMethod),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <Link to={`/transactions/${t.id}`} className="tx-row">
        <span className={`tx-icon ${t.type}`}>
          <CategoryIcon id={t.categoryId} />
        </span>
        <span className="tx-main">
          <span className="tx-title">{title}</span>
          <span className="tx-meta">
            {meta}
            {receipts > 0 && (
              <span className="tx-clip" title={`${receipts} factura(s)`}>
                <Icon name="clip" size={13} />
                {receipts}
              </span>
            )}
          </span>
        </span>
        <span className="tx-side">
          <span className={`tx-amount ${t.type}`}>
            {t.type === 'income' ? '+' : '−'}
            {money(t.amount)}
          </span>
          {t.syncStatus !== 'synced' && <StatusBadge status={t.syncStatus} compact />}
        </span>
      </Link>
    </li>
  );
}
