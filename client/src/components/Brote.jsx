import { useId, useMemo } from 'react';
import { broteSvg } from '../brand/brote.js';

/** La mascota Brote. `label` la hace legible para lectores de pantalla; sin label es decorativa. */
export default function Brote({ mood = 'happy', size = 96, label, animated = true, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const html = useMemo(() => broteSvg({ mood, animated, uid }), [mood, animated, uid]);
  return (
    <span
      className={`brote-wrap ${className}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
