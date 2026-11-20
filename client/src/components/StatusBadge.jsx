import Icon from './Icon.jsx';

const LABELS = {
  synced: ['check', 'Sincronizado'],
  pending: ['clock', 'Pendiente'],
  syncing: ['sync', 'Sincronizando'],
  error: ['alert', 'Error'],
};

export default function StatusBadge({ status, compact = false }) {
  const [icon, label] = LABELS[status] ?? LABELS.pending;
  return (
    <span className={`badge badge-${status}`} title={label}>
      <Icon name={icon} size={13} />
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}
