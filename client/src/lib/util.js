/** UUID v4. crypto.randomUUID solo existe en contextos seguros (https o localhost). */
export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const nowIso = () => new Date().toISOString();

/** Fecha local en formato YYYY-MM-DD (no UTC, para que "hoy" sea el día del usuario). */
export function toDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const moneyFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const money = (n) => moneyFmt.format(n || 0);

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDate = (key) => dateFmt.format(parseDateKey(key));

const monthFmt = new Intl.DateTimeFormat('es-CO', { month: 'short', year: '2-digit' });
export const formatMonth = (ym) => monthFmt.format(parseDateKey(`${ym}-01`));

export const PAYMENT_METHODS = [
  ['cash', 'Efectivo'],
  ['debit', 'Tarjeta débito'],
  ['credit', 'Tarjeta crédito'],
  ['transfer', 'Transferencia'],
  ['other', 'Otro'],
];
export const paymentLabel = (id) => PAYMENT_METHODS.find(([k]) => k === id)?.[1] ?? '';

const weekdayFmt = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
/** "Hoy", "Ayer" o "miércoles 12 de noviembre". */
export function dayLabel(key) {
  const today = toDateKey();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return 'Hoy';
  if (key === toDateKey(y)) return 'Ayer';
  return weekdayFmt.format(parseDateKey(key));
}

const monthLongFmt = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
export const formatMonthLong = (ym) => monthLongFmt.format(parseDateKey(`${ym}-01`)).replace(' de ', ' ');

/** Formatea dígitos mientras se escribe: "120000" -> "120.000". */
export const groupDigits = (digits) => (digits ? Number(digits).toLocaleString('es-CO') : '');
