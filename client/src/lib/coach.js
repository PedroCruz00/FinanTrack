import { budgetName, budgetStatus } from './budgets.js';
import { money, parseDateKey, toDateKey } from './util.js';

/**
 * Brote como guía: elige un estado de ánimo y un mensaje según la situación financiera
 * y técnica (conexión, errores de sincronización). Prioridad de arriba hacia abajo.
 */

const TIPS = [
  ['Un gasto, una foto', 'Toma la foto de la factura apenas pagues: después la encuentras buscando el establecimiento.'],
  ['Comparte y listo', 'Desde tu galería, toca "Compartir" en una foto de factura y elige FinanTrack: el gasto se crea con la foto adjunta.'],
  ['Los pequeños suman', 'Café, domicilios, pasajes… revisa en Reportes cuánto suman al mes.'],
  ['Sin señal, sin problema', 'Puedes registrar en el bus o en el sótano: lo guardo aquí y lo envío cuando vuelva la conexión.'],
  ['Mira la tendencia', 'Compara este mes con el anterior en Reportes. Lo que se mide, mejora.'],
];

const daysUntil = (dateKey) => Math.max(0, Math.round((parseDateKey(dateKey) - parseDateKey(toDateKey())) / 86400000));

export function coachMessage({ transactions, budgets, byId, online, outbox }) {
  const errors = outbox.filter((o) => o.status === 'error').length;

  if (!online) {
    const pending = outbox.length;
    return {
      mood: 'sleep',
      title: 'Modo sin conexión',
      text: pending
        ? `Sigue tranquilo: tengo ${pending} cambio${pending > 1 ? 's' : ''} guardado${pending > 1 ? 's' : ''} aquí y los envío cuando vuelva la señal.`
        : 'Puedes seguir registrando. Guardo todo en tu dispositivo y lo envío cuando vuelva la señal.',
    };
  }
  if (errors) {
    return { mood: 'worried', title: 'Algo no se pudo enviar', text: `${errors} cambio${errors > 1 ? 's' : ''} necesita${errors > 1 ? 'n' : ''} tu revisión.`, to: '/sync', cta: 'Revisar' };
  }
  if (!transactions.length) {
    return {
      mood: 'wave',
      title: '¡Hola! Soy Brote',
      text: 'Voy a ayudarte a cuidar tu dinero. Empieza registrando tu primer gasto o ingreso.',
      to: '/transactions/new',
      cta: 'Registrar',
    };
  }

  const statuses = budgets.map((b) => ({ b, s: budgetStatus(b, transactions) }));
  const exceeded = statuses.filter((x) => x.s.level === 'exceeded').sort((a, b) => b.s.pct - a.s.pct)[0];
  if (exceeded) {
    return {
      mood: 'sad',
      title: `Te pasaste en ${budgetName(exceeded.b, byId).toLowerCase()}`,
      text: `Llevas ${money(exceeded.s.spent)} de ${money(exceeded.b.amountLimit)}. Revisemos en qué se fue.`,
      to: '/budgets',
      cta: 'Ver',
    };
  }
  const warning = statuses.filter((x) => x.s.level === 'warning').sort((a, b) => b.s.pct - a.s.pct)[0];
  if (warning) {
    const left = daysUntil(warning.s.range.end);
    return {
      mood: 'worried',
      title: `Ojo con ${budgetName(warning.b, byId).toLowerCase()}`,
      text: `Vas al ${Math.round(warning.s.pct)} % y ${left === 0 ? 'el período termina hoy' : `quedan ${left} día${left > 1 ? 's' : ''}`}. Te quedan ${money(warning.s.remaining)}.`,
      to: '/budgets',
      cta: 'Ver',
    };
  }
  if (!budgets.length && transactions.length >= 3) {
    return {
      mood: 'think',
      title: '¿Y si pones un límite?',
      text: 'Con un presupuesto te aviso antes de que se te vaya la mano.',
      to: '/budgets',
      cta: 'Crear',
    };
  }

  const month = toDateKey().slice(0, 7);
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!t.date.startsWith(month)) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
  if (rate !== null && rate >= 20) {
    return { mood: 'celebrate', title: '¡Vas muy bien!', text: `Este mes llevas ahorrado el ${rate} % de lo que ingresaste.` };
  }

  const today = toDateKey();
  if (new Date().getHours() >= 18 && !transactions.some((t) => t.date === today)) {
    return { mood: 'think', title: '¿Cómo te fue hoy?', text: 'No veo movimientos de hoy. Anotarlos toma segundos.', to: '/transactions/new', cta: 'Anotar' };
  }

  const [title, text] = TIPS[new Date().getDate() % TIPS.length];
  return { mood: 'happy', title, text };
}
