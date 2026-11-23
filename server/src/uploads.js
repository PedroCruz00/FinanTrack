import { rm, unlink } from 'node:fs/promises';
import path from 'node:path';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');

export const uploadPath = (relPath) => path.join(UPLOAD_DIR, relPath);

/** Borra del disco las facturas indicadas. Un archivo que ya no existe no es un error. */
export async function removeUploads(relPaths) {
  await Promise.all(
    relPaths.map((p) =>
      unlink(uploadPath(p)).catch((err) => {
        if (err.code !== 'ENOENT') console.warn(`No se pudo borrar ${p}:`, err.message);
      }),
    ),
  );
}

export function removeUserUploads(userId) {
  return rm(uploadPath(userId), { recursive: true, force: true });
}
