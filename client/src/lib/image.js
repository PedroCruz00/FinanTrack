const MAX_SIDE = 1600;
const QUALITY = 0.72;

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* algunos navegadores no soportan la opción; usamos <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Reduce la foto a máx. 1600 px por lado y la recodifica como JPEG.
 * Una foto de cámara de 3–5 MB suele quedar en 150–400 KB, legible para una factura.
 */
export async function compressImage(file) {
  const source = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  source.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}

/** SHA-256 en hexadecimal; el servidor lo compara para detectar archivos dañados. */
export async function sha256Hex(blob) {
  if (!globalThis.crypto?.subtle) return ''; // contexto no seguro (http en otra IP)
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
