import { Link } from 'react-router-dom';
import Brote from './Brote.jsx';
import Icon from './Icon.jsx';

/** Brote comenta la situación: ánimo + mensaje + acción opcional. */
export default function CoachCard({ message }) {
  const { mood, title, text, to, cta } = message;
  return (
    <section className={`coach coach-${mood}`} aria-live="polite">
      <Brote mood={mood} size={84} label={`Brote, ${MOOD_LABEL[mood]}`} />
      <div className="coach-body">
        <strong>{title}</strong>
        <p>{text}</p>
        {to && (
          <Link to={to} className="coach-cta">
            {cta} <Icon name="chevronRight" size={15} />
          </Link>
        )}
      </div>
    </section>
  );
}

const MOOD_LABEL = {
  happy: 'contento',
  wave: 'saludando',
  celebrate: 'celebrando',
  worried: 'preocupado',
  sad: 'triste',
  sleep: 'dormido',
  think: 'pensativo',
};
