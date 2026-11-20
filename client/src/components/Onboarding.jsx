import { useState } from 'react';
import { loadDemoData } from '../lib/demo.js';
import { toast } from '../lib/events.js';
import Brote from './Brote.jsx';

const KEY = 'ft_onboarded';

const STEPS = [
  {
    mood: 'wave',
    title: 'Hola, soy Brote',
    text: 'Te acompaño a llevar tus cuentas: ingresos, gastos y presupuestos, en un solo lugar.',
  },
  {
    mood: 'sleep',
    title: 'Funciono sin Internet',
    text: 'Registra donde estés. Guardo todo en tu teléfono y lo sincronizo solo cuando vuelva la señal.',
  },
  {
    mood: 'celebrate',
    title: 'Tus facturas, a salvo',
    text: 'Toma una foto de cada compra y encuéntrala cuando la necesites. Yo te aviso si te acercas a tus límites.',
  },
];

export const needsOnboarding = () => !localStorage.getItem(KEY);

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem(KEY, '1');
    onDone();
  };

  async function withDemo() {
    setBusy(true);
    const n = await loadDemoData();
    toast(`Cargué ${n} movimientos de ejemplo para que explores`, 'success');
    finish();
  }

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onboarding-card" key={step}>
        <Brote mood={s.mood} size={168} />
        <h2 id="onb-title">{s.title}</h2>
        <p>{s.text}</p>
        <div className="dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'active' : ''} />
          ))}
        </div>
      </div>
      <div className="onboarding-actions">
        {last ? (
          <>
            <button className="btn btn-primary btn-lg btn-block" onClick={finish} disabled={busy}>
              Empezar
            </button>
            <button className="btn btn-ghost btn-block" onClick={withDemo} disabled={busy}>
              {busy ? 'Preparando…' : 'Explorar con datos de ejemplo'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(step + 1)}>
              Siguiente
            </button>
            <button className="btn btn-ghost btn-block" onClick={finish}>
              Saltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
