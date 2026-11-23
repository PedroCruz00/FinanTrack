import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { useCategories } from '../lib/hooks.js';
import { addReceipts, deleteReceipt, deleteTransaction, saveTransaction } from '../lib/repo.js';
import { toast } from '../lib/events.js';
import { amountWidth, groupDigits, PAYMENT_METHODS, toDateKey } from '../lib/util.js';
import { haptic } from '../lib/pwa.js';
import ReceiptImage from '../components/ReceiptImage.jsx';
import CameraCapture, { cameraSupported } from '../components/CameraCapture.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Icon, { CategoryIcon } from '../components/Icon.jsx';

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

export default function TransactionForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { list: categories } = useCategories();
  const isNew = !id;

  // undefined = cargando, null = no existe
  const existing = useLiveQuery(async () => (id ? ((await db.transactions.get(id)) ?? null) : null), [id], undefined);
  const receipts = useLiveQuery(() => (id ? db.receipts.where('transactionId').equals(id).toArray() : []), [id], []);

  const [form, setForm] = useState({
    type: params.get('type') === 'income' ? 'income' : 'expense',
    amount: '', // solo dígitos
    categoryId: '',
    date: toDateKey(),
    description: params.get('note') ?? '',
    merchant: '',
    paymentMethod: 'cash',
  });
  const [newFiles, setNewFiles] = useState([]); // fotos elegidas antes de guardar un movimiento nuevo
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(null);
  const loaded = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraInput = useRef();
  const galleryInput = useRef();

  useEffect(() => {
    if (existing && !loaded.current) {
      loaded.current = true;
      setForm({
        type: existing.type,
        amount: String(Math.round(existing.amount)),
        categoryId: existing.categoryId,
        date: existing.date,
        description: existing.description ?? '',
        merchant: existing.merchant ?? '',
        paymentMethod: existing.paymentMethod || 'cash',
      });
    }
  }, [existing]);

  // Fotos recibidas con "Compartir" desde otra app (Web Share Target → service worker → db.shared)
  useEffect(() => {
    if (!isNew || !params.get('shared')) return;
    let cancelled = false;
    (async () => {
      const items = await db.shared.toArray();
      await db.shared.clear();
      if (cancelled || !items.length) return;
      setNewFiles(items.map((it) => new File([it.blob], it.name || 'factura.jpg', { type: it.blob.type })));
      toast(`Recibí ${items.length} foto${items.length > 1 ? 's' : ''}: completa los datos del gasto`, 'success');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeCategories = useMemo(() => categories.filter((c) => c.type === form.type), [categories, form.type]);
  const previews = useMemo(() => newFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [newFiles]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  if (!isNew && existing === null) {
    return (
      <div className="page">
        <div className="empty-state">
          <Icon name="alert" size={28} />
          <p>Este movimiento no existe o fue eliminado.</p>
          <button className="btn" onClick={() => navigate('/transactions')}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/transactions'));
  const isExpense = form.type === 'expense';

  async function onPickFiles(e) {
    const files = [...e.target.files];
    e.target.value = '';
    await handleFiles(files);
  }

  // Cámara propia si el navegador la permite (pide el permiso); si no, la cámara del sistema
  function openCamera() {
    if (cameraSupported()) setCameraOpen(true);
    else cameraInput.current.click();
  }

  async function handleFiles(input) {
    const files = input.filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (isNew) {
      setNewFiles((prev) => [...prev, ...files]);
      return;
    }
    setBusy(true);
    try {
      const size = await addReceipts(id, files);
      toast(`Factura guardada (${kb(size)} tras comprimir)`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return toast('Escribe el valor del movimiento', 'error');
    if (!form.categoryId) return toast('Elige una categoría', 'error');
    setBusy(true);
    try {
      const savedId = await saveTransaction({ ...form, amount }, id);
      if (newFiles.length) await addReceipts(savedId, newFiles);
      haptic();
      toast(navigator.onLine ? 'Guardado' : 'Guardado sin conexión: se sincronizará al reconectar', 'success');
      goBack();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('¿Eliminar este movimiento y sus facturas?')) return;
    await deleteTransaction(id);
    toast('Movimiento eliminado', 'success');
    navigate('/transactions', { replace: true });
  }

  const switchType = (type) => setForm({ ...form, type, categoryId: '' });

  return (
    <form className="page form-page" onSubmit={submit}>
      <header className="form-top">
        <button type="button" className="icon-btn ghost" onClick={goBack} aria-label="Volver">
          <Icon name="back" />
        </button>
        <div className="type-switch" role="radiogroup" aria-label="Tipo de movimiento">
          <button type="button" role="radio" aria-checked={isExpense} className={isExpense ? 'active' : ''} onClick={() => switchType('expense')}>
            Gasto
          </button>
          <button type="button" role="radio" aria-checked={!isExpense} className={!isExpense ? 'active' : ''} onClick={() => switchType('income')}>
            Ingreso
          </button>
        </div>
        {isNew ? (
          <span className="icon-btn-spacer" />
        ) : (
          <button type="button" className="icon-btn ghost danger" onClick={remove} aria-label="Eliminar movimiento" disabled={busy}>
            <Icon name="trash" />
          </button>
        )}
      </header>

      <label className={`amount ${form.type}`}>
        <span className="sr-only">Valor</span>
        <span className="amount-currency">$</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={groupDigits(form.amount)}
          onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, '').slice(0, 12) })}
          autoFocus={isNew}
          style={{ width: amountWidth(groupDigits(form.amount) || '0') }}
        />
      </label>
      {existing && (
        <div className="center">
          <StatusBadge status={existing.syncStatus} />
        </div>
      )}

      <fieldset className="block">
        <legend className="block-label">Categoría</legend>
        <div className="cat-grid">
          {typeCategories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`cat ${form.categoryId === c.id ? 'active' : ''}`}
              onClick={() => setForm({ ...form, categoryId: c.id })}
              aria-pressed={form.categoryId === c.id}
            >
              <span className="cat-icon">
                <CategoryIcon id={c.id} size={22} />
              </span>
              <span className="cat-name">{c.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="block lines">
        <label className="line-field">
          <span>Descripción</span>
          <input value={form.description} onChange={set('description')} maxLength={255} placeholder={isExpense ? '¿Qué compraste?' : '¿De dónde viene?'} />
        </label>
        {isExpense && (
          <label className="line-field">
            <span>Establecimiento</span>
            <input value={form.merchant} onChange={set('merchant')} maxLength={120} placeholder="Ej.: Supermercado Central" />
          </label>
        )}
        <label className="line-field">
          <span>Fecha</span>
          <input type="date" value={form.date} onChange={set('date')} required />
        </label>
        <div className="line-field">
          <span>Método de pago</span>
          <div className="pills scroll">
            {PAYMENT_METHODS.map(([k, label]) => (
              <button
                type="button"
                key={k}
                className={`pill ${form.paymentMethod === k ? 'active' : ''}`}
                onClick={() => setForm({ ...form, paymentMethod: k })}
                aria-pressed={form.paymentMethod === k}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <fieldset className="block">
        <legend className="block-label">Facturas y soportes</legend>
        <div className="receipts">
          {receipts.map((r) => (
            <figure key={r.id} className="receipt">
              <ReceiptImage receipt={r} className="receipt-img" onClick={() => setViewer(r)} />
              <span className="receipt-status">
                <StatusBadge status={r.syncStatus} compact />
              </span>
              <button
                type="button"
                className="receipt-remove"
                aria-label="Quitar factura"
                onClick={() => window.confirm('¿Quitar esta factura?') && deleteReceipt(r.id)}
              >
                <Icon name="close" size={14} />
              </button>
            </figure>
          ))}
          {previews.map((p, i) => (
            <figure key={p.url} className="receipt">
              <img src={p.url} alt="Factura nueva" className="receipt-img" />
              <button
                type="button"
                className="receipt-remove"
                aria-label="Quitar"
                onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={14} />
              </button>
            </figure>
          ))}
          <button type="button" className="receipt-add" onClick={openCamera} disabled={busy}>
            <Icon name="camera" size={22} />
            <span>Cámara</span>
          </button>
          <button type="button" className="receipt-add" onClick={() => galleryInput.current.click()} disabled={busy}>
            <Icon name="image" size={22} />
            <span>Galería</span>
          </button>
        </div>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPickFiles} />
        <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
        <p className="hint">Se comprimen y quedan en tu dispositivo; se suben al sincronizar.</p>
      </fieldset>

      <div className="savebar">
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Guardando…' : isNew ? `Guardar ${isExpense ? 'gasto' : 'ingreso'}` : 'Guardar cambios'}
        </button>
      </div>

      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            handleFiles([file]);
          }}
          onGallery={() => {
            setCameraOpen(false);
            galleryInput.current.click();
          }}
        />
      )}

      {viewer && (
        <div className="viewer" role="dialog" aria-label="Factura" onClick={() => setViewer(null)}>
          <ReceiptImage receipt={viewer} className="viewer-img" />
          <button type="button" className="viewer-close" aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
      )}
    </form>
  );
}
