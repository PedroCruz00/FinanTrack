import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { useBudgets, useCategories, useReceiptCounts, useTransactions } from '../lib/hooks.js';
import { budgetHistory, budgetName, PERIOD_LABELS } from '../lib/budgets.js';
import { formatDate, formatMonth, formatMonthLong, money, paymentLabel, toDateKey } from '../lib/util.js';
import Icon, { CategoryIcon } from '../components/Icon.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  return toDateKey(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

const lastMonths = (n, ym) => Array.from({ length: n }, (_, i) => shiftMonth(ym, i - (n - 1)));

const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

function chartOptions(theme) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    font: { family: 'Plus Jakarta Sans Variable' },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: { color: theme.text, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, boxHeight: 8, padding: 16, font: { family: 'Plus Jakarta Sans Variable', size: 12 } },
      },
      tooltip: {
        backgroundColor: theme.ink,
        titleColor: theme.paper,
        bodyColor: theme.paper,
        padding: 10,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 4,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: theme.line }, ticks: { color: theme.text, maxRotation: 0, autoSkip: false, font: { family: 'Plus Jakarta Sans Variable', size: 11 } } },
      y: {
        beginAtZero: true,
        grid: { color: theme.line },
        border: { display: false },
        ticks: { color: theme.text, maxTicksLimit: 5, font: { family: 'Plus Jakarta Sans Variable', size: 11 }, callback: (v) => `$${compact.format(v)}` },
      },
    },
  };
}

function buildCsv(transactions, byId, receiptCounts, month) {
  const rows = transactions.filter((t) => !month || t.date.startsWith(month));
  const header = ['Fecha', 'Tipo', 'Categoría', 'Valor', 'Descripción', 'Establecimiento', 'Método de pago', 'Facturas'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((t) =>
    [
      t.date,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      byId[t.categoryId]?.name ?? t.categoryId,
      t.amount,
      t.description,
      t.merchant,
      paymentLabel(t.paymentMethod),
      receiptCounts[t.id] ?? 0,
    ]
      .map(escape)
      .join(';'),
  );
  // BOM + ';' para que Excel en español lo abra con columnas y tildes correctas
  const content = '\uFEFF' + [header.join(';'), ...lines].join('\r\n');
  return new File([content], `finantrack-${month || 'historial'}.csv`, { type: 'text/csv' });
}

function download(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Web Share API con archivos (móvil); si no está disponible, descarga. */
async function shareOrDownload(file, title) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  download(file);
}

export default function Reports() {
  const transactions = useTransactions();
  const budgets = useBudgets();
  const receiptCounts = useReceiptCounts();
  const { byId } = useCategories();
  const currentMonth = toDateKey().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const theme = {
    text: css('--ink-3'),
    line: css('--line'),
    ink: css('--ink'),
    paper: css('--paper'),
    sheet: css('--paper'),
    income: css('--chart-income'),
    expense: css('--chart-expense'),
  };

  const months = lastMonths(6, month);
  const prevMonth = months[months.length - 2];

  const monthly = useMemo(() => {
    const sums = Object.fromEntries(months.map((m) => [m, { income: 0, expense: 0 }]));
    for (const t of transactions) {
      const m = t.date.slice(0, 7);
      if (sums[m]) sums[m][t.type] += t.amount;
    }
    return sums;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, month]);

  const categoryRows = useMemo(() => {
    const cur = {};
    const prev = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const m = t.date.slice(0, 7);
      if (m === month) cur[t.categoryId] = (cur[t.categoryId] ?? 0) + t.amount;
      if (m === prevMonth) prev[t.categoryId] = (prev[t.categoryId] ?? 0) + t.amount;
    }
    const total = Object.values(cur).reduce((a, b) => a + b, 0);
    return Object.entries(cur)
      .map(([id, amount]) => ({ id, amount, share: total ? amount / total : 0, prev: prev[id] ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, month, prevMonth]);

  // 2 px de separación (color del fondo) entre barras: codificación secundaria exigida por la paleta
  const bar = { borderRadius: 4, borderColor: theme.sheet, borderWidth: 2, borderSkipped: 'bottom', maxBarThickness: 26 };
  const chartData = {
    // Etiqueta corta: "jun"; el año solo en enero o en el primer mes mostrado
    labels: months.map((m, i) => (i === 0 || m.endsWith('-01') ? formatMonth(m) : formatMonth(m).split(' ')[0]).replace('.', '').replace(' de ', ' ')),
    datasets: [
      { label: 'Ingresos', data: months.map((m) => monthly[m].income), backgroundColor: theme.income, ...bar },
      { label: 'Gastos', data: months.map((m) => monthly[m].expense), backgroundColor: theme.expense, ...bar },
    ],
  };

  const cur = monthly[month];
  const prev = monthly[prevMonth];
  const saved = cur.income - cur.expense;
  const change = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const expenseChange = change(cur.expense, prev.expense);
  const maxCat = categoryRows[0]?.amount ?? 0;

  async function shareSummary() {
    const top = categoryRows[0];
    const text = [
      `Mi resumen de ${formatMonthLong(month)} en FinanTrack:`,
      `Ingresos ${money(cur.income)} · Gastos ${money(cur.expense)}`,
      saved >= 0 ? `Ahorré ${money(saved)}` : `Gasté ${money(-saved)} más de lo que ingresé`,
      top ? `Donde más gasté: ${byId[top.id]?.name ?? top.id} (${money(top.amount)})` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.share({ title: 'Mi resumen en FinanTrack', text });
    } catch {
      /* el usuario canceló */
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Reportes</h1>

      <div className="month-switch">
        <button className="icon-btn ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">
          <Icon name="chevronLeft" />
        </button>
        <span>{formatMonthLong(month)}</span>
        <button
          className="icon-btn ghost"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= currentMonth}
          aria-label="Mes siguiente"
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      <section className="hero compact">
        <p className="hero-label">{saved >= 0 ? 'Ahorraste' : 'Gastaste de más'}</p>
        <p className={`hero-amount ${saved < 0 ? 'negative' : ''}`}>{money(Math.abs(saved))}</p>
        <p className="hero-note">
          {cur.income > 0 && saved >= 0 && `${Math.round((saved / cur.income) * 100)} % de tus ingresos. `}
          {expenseChange !== null &&
            `Gastos ${expenseChange >= 0 ? 'subieron' : 'bajaron'} ${Math.abs(expenseChange)} % frente a ${formatMonthLong(prevMonth).split(' ')[0]}.`}
        </p>
        <div className="hero-split">
          <span>
            <span className="flow-icon income">
              <Icon name="arrowDown" size={14} />
            </span>
            <span>
              <small>Ingresos</small>
              {money(cur.income)}
            </span>
          </span>
          <span>
            <span className="flow-icon expense">
              <Icon name="arrowUp" size={14} />
            </span>
            <span>
              <small>Gastos</small>
              {money(cur.expense)}
            </span>
          </span>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Ingresos frente a gastos · 6 meses</h2>
        <div className="chart">
          <Bar data={chartData} options={chartOptions(theme)} />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Categorías con más gasto</h2>
        {categoryRows.length === 0 ? (
          <p className="hint">Sin gastos en {formatMonthLong(month)}.</p>
        ) : (
          <ul className="rank">
            {categoryRows.map((r) => {
              const delta = change(r.amount, r.prev);
              return (
                <li key={r.id}>
                  <span className="tx-icon expense">
                    <CategoryIcon id={r.id} size={18} />
                  </span>
                  <span className="rank-main">
                    <span className="rank-top">
                      <span>{byId[r.id]?.name ?? r.id}</span>
                      <span className="num">{money(r.amount)}</span>
                    </span>
                    <span className="hbar-track">
                      <span className="hbar-fill expense" style={{ width: `${(r.amount / maxCat) * 100}%` }} />
                    </span>
                    <small>
                      {Math.round(r.share * 100)} % del gasto
                      {delta !== null && ` · ${delta >= 0 ? '+' : '−'}${Math.abs(delta)} % vs. mes anterior`}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Historial de presupuestos</h2>
        {budgets.length === 0 ? (
          <p className="hint">No hay presupuestos definidos.</p>
        ) : (
          <ul className="history">
            {budgets.map((b) => {
              const history = budgetHistory(b, transactions);
              const met = history.filter((h) => !h.exceeded).length;
              return (
                <li key={b.id}>
                  <div className="history-top">
                    <span>{budgetName(b, byId)}</span>
                    <small>
                      {PERIOD_LABELS[b.period]} · {money(b.amountLimit)}
                    </small>
                  </div>
                  {history.length === 0 ? (
                    <small className="hint">Aún no hay períodos cerrados.</small>
                  ) : (
                    <>
                      <div className="history-dots">
                        {[...history].reverse().map((h) => (
                          <span
                            key={h.key}
                            className={`hdot ${h.exceeded ? 'exceeded' : 'met'}`}
                            title={`${formatDate(h.start)} – ${formatDate(h.end)}: ${money(h.spent)} (${h.exceeded ? 'excedido' : 'cumplido'})`}
                          >
                            <Icon name={h.exceeded ? 'close' : 'check'} size={12} />
                          </span>
                        ))}
                      </div>
                      <small className="hint">
                        Cumplido en {met} de {history.length} período{history.length > 1 ? 's' : ''}
                      </small>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Exportar</h2>
        <div className="row-gap">
          {'share' in navigator && (
            <button className="btn btn-primary" onClick={shareSummary}>
              <Icon name="share" size={18} /> Compartir resumen
            </button>
          )}
          <button className="btn" onClick={() => shareOrDownload(buildCsv(transactions, byId, receiptCounts, month), `Movimientos de ${formatMonthLong(month)}`)}>
            <Icon name="download" size={18} /> CSV de {formatMonthLong(month).split(' ')[0]}
          </button>
          <button className="btn btn-ghost" onClick={() => shareOrDownload(buildCsv(transactions, byId, receiptCounts, null), 'Historial de FinanTrack')}>
            <Icon name="download" size={18} /> Todo el historial
          </button>
        </div>
      </section>
    </div>
  );
}
