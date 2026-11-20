import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { db } from '../lib/db.js';

/**
 * Muestra una factura. Si la imagen está en el dispositivo se usa directamente;
 * si solo está en el servidor (creada en otro dispositivo) se descarga con el token
 * y se guarda en IndexedDB para poder verla después sin conexión.
 */
export default function ReceiptImage({ receipt, className, onClick }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    async function load() {
      let blob = receipt.blob;
      if (!blob) {
        if (!navigator.onLine) {
          setError('Disponible al conectarse');
          return;
        }
        try {
          const res = await api(`/receipts/${receipt.id}/file`, { raw: true });
          blob = await res.blob();
          await db.receipts.update(receipt.id, { blob });
        } catch {
          if (!cancelled) setError('No se pudo descargar');
          return;
        }
      }
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }
    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [receipt.id, receipt.blob]);

  if (error) return <div className={`receipt-placeholder ${className ?? ''}`}>{error}</div>;
  if (!url) return <div className={`receipt-placeholder ${className ?? ''}`}>Cargando…</div>;
  return <img src={url} alt={receipt.description || 'Factura'} className={className} onClick={onClick} />;
}
