import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { findProcessed, recordProcessed } from './sync.js';
import { uploadPath } from '../uploads.js';

const router = Router();
router.use(requireAuth);

const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

const fieldsSchema = z.object({
  opId: z.uuid(),
  id: z.uuid(),
  transactionId: z.uuid(),
  capturedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  description: z.string().trim().max(255).optional().default(''),
  hash: z.string().regex(/^[a-f0-9]{64}$/).optional().or(z.literal('')),
});

/** Detecta el tipo real del archivo por sus primeros bytes (no confiamos en el nombre ni en el mimetype enviado). */
function detectImage(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png' };
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/**
 * POST /api/receipts (multipart: campo `file` + metadatos)
 * Idempotente: el id de la factura y el opId vienen del dispositivo.
 */
router.post('/', upload.single('file'), async (req, res) => {
  const parsed = fieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ status: 'error', error: 'Metadatos de factura inválidos' });
  const f = parsed.data;
  const userId = req.user.id;
  const op = { opId: f.opId, entity: 'receipt', action: 'upsert' };

  // ¿Ya se procesó esta operación? (reenvío tras un corte de red)
  const previous = await findProcessed(pool, f.opId, userId).catch(() => undefined);
  if (previous === undefined) return res.status(409).json({ status: 'error', error: 'opId en uso por otro usuario' });
  if (previous) return res.json({ ...previous, duplicate: true });

  if (!req.file) return res.status(400).json({ status: 'error', error: 'Falta el archivo' });
  const kind = detectImage(req.file.buffer);
  if (!kind) return res.status(415).json({ status: 'error', error: 'Solo se aceptan imágenes JPEG, PNG o WebP' });

  const hash = createHash('sha256').update(req.file.buffer).digest('hex');
  if (f.hash && f.hash !== hash) {
    return res.status(422).json({ status: 'error', error: 'El archivo llegó dañado (hash distinto); se reintentará', retryable: true });
  }

  const [txRows] = await pool.query('SELECT user_id, deleted FROM transactions WHERE id = ?', [f.transactionId]);
  const tx = txRows[0];
  if (!tx) {
    // El movimiento aún no ha llegado al servidor: el cliente debe reintentar más tarde.
    return res.status(409).json({ status: 'error', error: 'El movimiento asociado aún no está sincronizado', retryable: true });
  }
  if (tx.user_id !== userId) return res.status(403).json({ status: 'error', error: 'Movimiento de otro usuario' });

  const relPath = path.join(userId, `${f.id}.${kind.ext}`);
  const absPath = uploadPath(relPath);
  let wroteFile = false;

  try {
    const result = await withTransaction(async (conn) => {
      const again = await findProcessed(conn, f.opId, userId);
      if (again) return { ...again, duplicate: true };

      const [existing] = await conn.query('SELECT user_id FROM receipts WHERE id = ? FOR UPDATE', [f.id]);
      if (existing.length && existing[0].user_id !== userId) throw Object.assign(new Error('forbidden'), { status: 403 });

      let status = 'ok';
      if (tx.deleted) {
        status = 'stale'; // el movimiento fue eliminado en otro dispositivo
      } else if (!existing.length) {
        await mkdir(path.dirname(absPath), { recursive: true });
        await writeFile(absPath, req.file.buffer);
        wroteFile = true;
        await conn.query(
          `INSERT INTO receipts
             (id, user_id, transaction_id, file_path, mime_type, size_bytes, file_hash, description, captured_at, client_updated_at, server_updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [f.id, userId, f.transactionId, relPath, kind.mime, req.file.size, hash, f.description || null,
            new Date(f.capturedAt), new Date(f.updatedAt)],
        );
      }
      const out = { opId: f.opId, status, hash };
      await recordProcessed(conn, userId, op, out);
      return out;
    });
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    if (wroteFile) await unlink(absPath).catch(() => {});
    if (err.status === 403) return res.status(403).json({ status: 'error', error: 'Factura de otro usuario' });
    throw err;
  }
});

/** GET /api/receipts/:id/file -> descarga protegida: solo el dueño puede ver su factura. */
router.get('/:id/file', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT file_path, mime_type FROM receipts WHERE id = ? AND user_id = ? AND deleted = 0',
    [req.params.id, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Factura no encontrada' });
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.type(rows[0].mime_type);
  res.sendFile(uploadPath(rows[0].file_path));
});

export default router;
