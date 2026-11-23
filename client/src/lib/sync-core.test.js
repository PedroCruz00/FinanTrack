import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getMeta } from './db.js';
import { setApiToken } from './api.js';
import { pullChanges, pushOutbox, runSyncCycle } from './sync-core.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const emptyPull = (extra = {}) => ({
  serverTime: '2026-11-20T12:00:00.000Z',
  transactions: [],
  budgets: [],
  receipts: [],
  ...extra,
});

const movement = (id, patch = {}) => ({
  id,
  type: 'expense',
  categoryId: 'food',
  amount: 1000,
  date: '2026-11-20',
  description: '',
  paymentMethod: 'cash',
  merchant: '',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ...patch,
});

async function queue(id, patch = {}) {
  const { id: entityId, updatedAt, ...payload } = movement(id, patch);
  await db.transactions.put({ id: entityId, ...payload, updatedAt, syncStatus: 'pending' });
  return db.outbox.add({
    opId: `op-${id}`,
    entity: 'transaction',
    action: 'upsert',
    entityId,
    payload,
    updatedAt,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
  });
}

let requests;
function serve(handler) {
  requests = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ url, method: init.method ?? 'GET', body });
    return handler(url, body);
  });
}

const acceptAll = (_url, body) => json({ results: body.operations.map((o) => ({ opId: o.opId, status: 'ok' })) });

beforeEach(async () => {
  setApiToken('token-de-prueba');
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.categories.put({ id: 'food', name: 'Alimentación', type: 'expense' });
});

afterEach(() => vi.restoreAllMocks());

describe('pushOutbox', () => {
  it('envía la cola en orden, la vacía y marca los registros como sincronizados', async () => {
    await queue('a');
    await queue('b');
    serve(acceptAll);

    await pushOutbox();

    expect(requests).toHaveLength(1);
    expect(requests[0].body.operations.map((o) => o.entityId)).toEqual(['a', 'b']);
    expect(requests[0].body.operations[0]).not.toHaveProperty('status');
    expect(await db.outbox.count()).toBe(0);
    expect((await db.transactions.get('a')).syncStatus).toBe('synced');
  });

  it('sin conexión conserva la operación y programa el reintento', async () => {
    await queue('a');
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(pushOutbox()).rejects.toMatchObject({ status: 0 });

    const [op] = await db.outbox.toArray();
    expect(op).toMatchObject({ status: 'pending', attempts: 1 });
    expect(op.nextAttemptAt).toBeGreaterThan(Date.now());
    expect((await db.transactions.get('a')).syncStatus).toBe('pending');
  });

  it('una operación en espera de reintento no se envía antes de tiempo, salvo en sincronización manual', async () => {
    const seq = await queue('a');
    await db.outbox.update(seq, { attempts: 1, nextAttemptAt: Date.now() + 60_000 });
    serve(acceptAll);

    await pushOutbox();
    expect(requests).toHaveLength(0);

    await pushOutbox({ manual: true });
    expect(requests).toHaveLength(1);
  });

  it('si el servidor rechaza una operación, queda en error sin bloquear a las demás', async () => {
    await queue('mala');
    await queue('buena');
    serve((_url, body) =>
      json({
        results: body.operations.map((o) =>
          o.entityId === 'mala'
            ? { opId: o.opId, status: 'error', error: 'Categoría inexistente' }
            : { opId: o.opId, status: 'ok' },
        ),
      }),
    );

    await pushOutbox();

    const left = await db.outbox.toArray();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ entityId: 'mala', status: 'error', lastError: 'Categoría inexistente' });
    expect((await db.transactions.get('mala')).syncStatus).toBe('error');
    expect((await db.transactions.get('buena')).syncStatus).toBe('synced');
  });
});

describe('pullChanges', () => {
  it('aplica cambios y eliminaciones, pero no pisa registros con cambios locales pendientes', async () => {
    await db.transactions.put({ ...movement('borrado'), syncStatus: 'synced' });
    await queue('local', { amount: 1 });
    serve(() =>
      json(
        emptyPull({
          transactions: [
            { ...movement('nuevo'), deleted: false },
            { ...movement('borrado'), deleted: true },
            { ...movement('local', { amount: 999 }), deleted: false },
          ],
        }),
      ),
    );

    await pullChanges();

    expect(await db.transactions.get('nuevo')).toMatchObject({ syncStatus: 'synced' });
    expect(await db.transactions.get('borrado')).toBeUndefined();
    expect((await db.transactions.get('local')).amount).toBe(1);
    expect(await getMeta('lastPull')).toBe('2026-11-20T12:00:00.000Z');
  });

  it('pide solo los cambios posteriores a la última sincronización', async () => {
    await db.meta.put({ key: 'lastPull', value: '2026-11-19T00:00:00.000Z' });
    serve(() => json(emptyPull()));

    await pullChanges();

    expect(requests[0].url).toBe('/api/sync/pull?since=2026-11-19T00%3A00%3A00.000Z');
  });
});

describe('runSyncCycle', () => {
  it('si el servidor responde stale, hace un pull completo para adoptar su versión', async () => {
    await db.meta.put({ key: 'lastPull', value: '2026-11-19T00:00:00.000Z' });
    await queue('a');
    serve((url, body) =>
      url.endsWith('/sync/push')
        ? json({ results: body.operations.map((o) => ({ opId: o.opId, status: 'stale' })) })
        : json(emptyPull()),
    );

    expect(await runSyncCycle()).toBe('done');
    expect(requests.map((r) => r.url)).toEqual(['/api/sync/push', '/api/sync/pull']);
  });
});
