import { useEffect, useState } from 'react';
import { on } from '../lib/events.js';
import Icon from './Icon.jsx';

const ICON = { info: 'bell', success: 'check', warning: 'alert', error: 'alert' };

export default function Toasts() {
  const [items, setItems] = useState([]);

  useEffect(
    () =>
      on('toast', (t) => {
        setItems((prev) => [...prev.slice(-2), t]);
        setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 5000);
      }),
    [],
  );

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}>
          <Icon name={ICON[t.kind]} size={18} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
