// Pruebas de integración de la API. Requieren el servidor corriendo (npm run dev) y MySQL.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api';
let token;

async function call(path, { method = 'GET', json, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: json ? JSON.stringify(json) : form });
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
}

const op = (entity, action, entityId, payload, updatedAt = new Date().toISOString()) => ({
  opId: randomUUID(), entity, action, entityId, payload, updatedAt,
});

// PNG mínimo válido de 1x1
function tinyPng() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0]))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const txId = randomUUID();
const txPayload = { type: 'expense', categoryId: 'food', amount: 45000, date: '2026-11-10', description: 'Mercado', paymentMethod: 'cash', merchant: 'Tienda' };

test('registro y login', async () => {
  const email = `test-${Date.now()}@example.com`;
  const reg = await call('/auth/register', { method: 'POST', json: { name: 'Prueba', email, password: 'secreta123' } });
  assert.equal(reg.status, 201);
  const login = await call('/auth/login', { method: 'POST', json: { email, password: 'secreta123' } });
  assert.equal(login.status, 200);
  token = login.body.token;
  const bad = await call('/auth/login', { method: 'POST', json: { email, password: 'otra' } });
  assert.equal(bad.status, 401);
});

test('categorías requieren sesión', async () => {
  const res = await call('/categories');
  assert.equal(res.status, 200);
  assert.ok(res.body.some((c) => c.id === 'food'));
});

test('una operación reenviada no crea duplicados (idempotencia)', async () => {
  const create = op('transaction', 'upsert', txId, txPayload);
  const first = await call('/sync/push', { method: 'POST', json: { operations: [create] } });
  assert.equal(first.body.results[0].status, 'ok');
  const again = await call('/sync/push', { method: 'POST', json: { operations: [create] } });
  assert.equal(again.body.results[0].status, 'ok');
  assert.equal(again.body.results[0].duplicate, true);
  const pull = await call('/sync/pull');
  assert.equal(pull.body.transactions.filter((t) => t.id === txId).length, 1);
});

test('conflicto: una versión más antigua no sobrescribe a la nueva', async () => {
  const newer = op('transaction', 'upsert', txId, { ...txPayload, amount: 50000 }, new Date(Date.now() + 1000).toISOString());
  const older = op('transaction', 'upsert', txId, { ...txPayload, amount: 1 }, new Date(Date.now() - 60000).toISOString());
  const res = await call('/sync/push', { method: 'POST', json: { operations: [newer, older] } });
  assert.deepEqual(res.body.results.map((r) => r.status), ['ok', 'stale']);
  const pull = await call('/sync/pull');
  assert.equal(pull.body.transactions.find((t) => t.id === txId).amount, 50000);
});

test('validaciones: categoría de otro tipo y valor negativo', async () => {
  const res = await call('/sync/push', {
    method: 'POST',
    json: {
      operations: [
        op('transaction', 'upsert', randomUUID(), { ...txPayload, categoryId: 'salary' }),
        op('transaction', 'upsert', randomUUID(), { ...txPayload, amount: -5 }),
      ],
    },
  });
  assert.deepEqual(res.body.results.map((r) => r.status), ['error', 'error']);
});

let receiptId;
test('factura: subida idempotente, descarga y rechazo de archivos que no son imagen', async () => {
  receiptId = randomUUID();
  const opId = randomUUID();
  const png = tinyPng();
  const makeForm = (file) => {
    const f = new FormData();
    f.append('opId', opId);
    f.append('id', receiptId);
    f.append('transactionId', txId);
    f.append('capturedAt', new Date().toISOString());
    f.append('updatedAt', new Date().toISOString());
    f.append('file', new Blob([file]), 'f.png');
    return f;
  };
  const up = await call('/receipts', { method: 'POST', form: makeForm(png) });
  assert.equal(up.status, 201);
  const dup = await call('/receipts', { method: 'POST', form: makeForm(png) });
  assert.equal(dup.status, 200);
  assert.equal(dup.body.duplicate, true);

  const file = await call(`/receipts/${receiptId}/file`);
  assert.equal(file.status, 200);
  assert.equal(Buffer.from(file.body).length, png.length);

  const fake = new FormData();
  fake.append('opId', randomUUID());
  fake.append('id', randomUUID());
  fake.append('transactionId', txId);
  fake.append('capturedAt', new Date().toISOString());
  fake.append('updatedAt', new Date().toISOString());
  fake.append('file', new Blob(['<script>alert(1)</script>']), 'x.png');
  assert.equal((await call('/receipts', { method: 'POST', form: fake })).status, 415);
});

test('factura de un movimiento que aún no llegó: 409 reintentable', async () => {
  const f = new FormData();
  f.append('opId', randomUUID());
  f.append('id', randomUUID());
  f.append('transactionId', randomUUID());
  f.append('capturedAt', new Date().toISOString());
  f.append('updatedAt', new Date().toISOString());
  f.append('file', new Blob([tinyPng()]), 'f.png');
  const res = await call('/receipts', { method: 'POST', form: f });
  assert.equal(res.status, 409);
  assert.equal(res.body.retryable, true);
});

test('eliminar un movimiento elimina sus facturas y una edición vieja no lo revive', async () => {
  const since = new Date().toISOString();
  const del = await call('/sync/push', { method: 'POST', json: { operations: [op('transaction', 'delete', txId)] } });
  assert.equal(del.body.results[0].status, 'ok');
  const revive = await call('/sync/push', {
    method: 'POST',
    json: { operations: [op('transaction', 'upsert', txId, txPayload, new Date(Date.now() + 5000).toISOString())] },
  });
  assert.equal(revive.body.results[0].status, 'stale');
  const pull = await call(`/sync/pull?since=${encodeURIComponent(since)}`);
  assert.equal(pull.body.transactions.find((t) => t.id === txId).deleted, true);
  assert.equal(pull.body.receipts.find((r) => r.id === receiptId).deleted, true);
  assert.equal((await call(`/receipts/${receiptId}/file`)).status, 404);
});

test('presupuestos: crear y validar categoría de gasto', async () => {
  const id = randomUUID();
  const res = await call('/sync/push', {
    method: 'POST',
    json: {
      operations: [
        op('budget', 'upsert', id, { categoryId: 'food', amountLimit: 600000, period: 'monthly', alertPercent: 80, createdAt: new Date().toISOString() }),
        op('budget', 'upsert', randomUUID(), { categoryId: 'salary', amountLimit: 1, period: 'monthly', alertPercent: 80, createdAt: new Date().toISOString() }),
      ],
    },
  });
  assert.deepEqual(res.body.results.map((r) => r.status), ['ok', 'error']);
});

test('aislamiento: otro usuario no ve ni modifica mis datos', async () => {
  const mine = randomUUID();
  await call('/sync/push', { method: 'POST', json: { operations: [op('transaction', 'upsert', mine, txPayload)] } });
  const myToken = token;
  const other = await call('/auth/register', {
    method: 'POST',
    json: { name: 'Otro', email: `otro-${Date.now()}@example.com`, password: 'secreta123' },
  });
  token = other.body.token;
  const pull = await call('/sync/pull');
  assert.equal(pull.body.transactions.length, 0);
  const hijack = await call('/sync/push', { method: 'POST', json: { operations: [op('transaction', 'delete', mine)] } });
  assert.equal(hijack.body.results[0].status, 'error');
  token = myToken;
});

test('web push: clave pública, validación, suscripción y limpieza de suscripciones caducadas', async () => {
  const { createECDH, randomBytes } = await import('node:crypto');
  const key = await call('/push/key');
  assert.equal(key.status, 200);
  assert.ok(key.body.key.length > 80);

  const bad = await call('/push/subscribe', { method: 'POST', json: { endpoint: 'no-es-url', keys: {} } });
  assert.equal(bad.status, 400);

  // Los servicios push reales usan https: un endpoint http se rechaza
  const http = await call('/push/subscribe', { method: 'POST', json: { endpoint: 'http://example.com/x', keys: { p256dh: 'a', auth: 'b' } } });
  assert.equal(http.status, 400);

  // Suscripción válida apuntando a un endpoint local inalcanzable por TLS (no sale tráfico a internet):
  // el servidor intenta el envío, falla y responde sin caerse.
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const sub = {
    endpoint: `https://localhost:4000/api/health?sub=${Date.now()}`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
  };
  assert.equal((await call('/push/subscribe', { method: 'POST', json: sub })).status, 201);
  const sent = await call('/push/test', { method: 'POST' });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.sent, 0);
  assert.equal((await call('/push/unsubscribe', { method: 'POST', json: { endpoint: sub.endpoint } })).status, 200);
});
