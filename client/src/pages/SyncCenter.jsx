import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { useOutbox } from '../lib/hooks.js';
import { discardOperation, retryFailed, syncNow, useSyncState } from '../lib/sync.js';
import Icon from '../components/Icon.jsx';
import Brote from '../components/Brote.jsx';

const ENTITY = { transaction: 'movimiento', budget: 'presupuesto', receipt: 'factura' };
const ACTION = { upsert: 'Guardar', delete: 'Eliminar' };
const STATUS = { pending: ['clock', 'En cola'], syncing: ['sync', 'Enviando'], error: ['alert', 'Error'] };

const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

function useCounts() {
  return useLiveQuery(
    async () => {
      const out = [];
      for (const [name, table] of [
        ['Movimientos', db.transactions],
        ['Presupuestos', db.budgets],
        ['Facturas', db.receipts],
      ]) {
        const c = { synced: 0, pending: 0, error: 0 };
        await table.each((r) => {
          const k = r.syncStatus === 'syncing' ? 'pending' : r.syncStatus;
          c[k] = (c[k] ?? 0) + 1;
        });
        out.push([name, c]);
      }
      return out;
    },
    [],
    [],
  );
}

export default function SyncCenter() {
  const sync = useSyncState();
  const outbox = useOutbox();
  const counts = useCounts();
  const errors = outbox.filter((o) => o.status === 'error');

  let title = 'Todo al día';
  let sub = sync.lastSyncAt ? `Última sincronización a las ${timeFmt.format(sync.lastSyncAt)}` : 'Tus datos están en el dispositivo y en el servidor';
  if (!sync.online) [title, sub] = ['Sin conexión', 'Puedes seguir usando la app; enviaremos los cambios al reconectar'];
  if (outbox.length) {
    title = errors.length ? `${errors.length} cambio${errors.length > 1 ? 's' : ''} con error` : `${outbox.length} cambio${outbox.length > 1 ? 's' : ''} pendiente${outbox.length > 1 ? 's' : ''}`;
  }

  return (
    <div className="page">
      <h1 className="page-title">Sincronización</h1>

      <section className={`sync-hero ${errors.length ? 'is-error' : outbox.length ? 'is-pending' : 'is-ok'}`}>
        <Brote
          mood={sync.running ? 'think' : errors.length ? 'worried' : !sync.online ? 'sleep' : outbox.length ? 'think' : 'celebrate'}
          size={112}
          label={title}
        />
        <p className="sync-hero-title">{title}</p>
        <p className="sync-hero-sub">{sync.lastError && sync.online ? sync.lastError : sub}</p>
        <div className="row-gap">
          <button className="btn btn-primary" onClick={() => syncNow({ manual: true })} disabled={!sync.online || sync.running}>
            <Icon name="sync" size={18} className={sync.running ? 'spin' : ''} />
            {sync.running ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
          {errors.length > 0 && (
            <button className="btn" onClick={retryFailed} disabled={!sync.online || sync.running}>
              Reintentar
            </button>
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Registros en este dispositivo</h2>
        <ul className="kv-list">
          {counts.map(([name, c]) => (
            <li key={name}>
              <span>{name}</span>
              <span className="kv-values">
                <span title="Sincronizados">
                  <Icon name="check" size={14} /> {c.synced}
                </span>
                {c.pending > 0 && (
                  <span className="warn" title="Pendientes">
                    <Icon name="clock" size={14} /> {c.pending}
                  </span>
                )}
                {c.error > 0 && (
                  <span className="err" title="Con error">
                    <Icon name="alert" size={14} /> {c.error}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {outbox.length > 0 && (
        <section className="section">
          <h2 className="section-title">Cola de envío</h2>
          <ul className="queue">
            {outbox.map((o) => {
              const [sIcon, sLabel] = STATUS[o.status];
              return (
                <li key={o.seq} className={`queue-item q-${o.status}`}>
                  <Icon name={sIcon} size={18} />
                  <span className="queue-main">
                    <span>
                      {ACTION[o.action]} {ENTITY[o.entity]}
                    </span>
                    <small>
                      {sLabel}
                      {o.attempts > 0 && ` · ${o.attempts} intento${o.attempts > 1 ? 's' : ''}`}
                      {o.lastError && ` · ${o.lastError}`}
                      {o.status === 'pending' && o.nextAttemptAt > Date.now() && ` · reintento ${timeFmt.format(new Date(o.nextAttemptAt))}`}
                    </small>
                  </span>
                  {o.status === 'error' && (
                    <button
                      className="btn-text danger"
                      onClick={() =>
                        window.confirm('Se descartará tu cambio local y se usará la versión del servidor. ¿Continuar?') &&
                        discardOperation(o.seq)
                      }
                    >
                      Descartar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <details className="section how">
        <summary>¿Cómo funciona sin conexión?</summary>
        <ol>
          <li>Todo se guarda primero en este dispositivo, con o sin Internet.</li>
          <li>Cada cambio entra a una cola con un identificador único.</li>
          <li>Al abrir la app, al reconectar, cada minuto o con el botón, la cola se envía en orden.</li>
          <li>El servidor ignora envíos repetidos: nunca se crean duplicados.</li>
          <li>Si editas lo mismo en dos dispositivos, gana el cambio más reciente; eliminar siempre gana.</li>
          <li>Las fotos se quedan en el dispositivo hasta que el servidor confirma que las recibió.</li>
        </ol>
      </details>

    </div>
  );
}
