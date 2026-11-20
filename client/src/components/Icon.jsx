// Íconos lineales propios (24 px, trazo 1.75, currentColor). Ver skill "minimal-mobile-ui".
const P = (d) => <path d={d} />;
const C = (cx, cy, r) => <circle cx={cx} cy={cy} r={r} />;

const ICONS = {
  home: P('M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1H15v-5.5H9V20H4.5a1 1 0 0 1-1-1z'),
  list: P('M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01'),
  plus: P('M12 5v14M5 12h14'),
  target: (
    <>
      {C(12, 12, 8.5)}
      {C(12, 12, 4.5)}
      {C(12, 12, 0.6)}
    </>
  ),
  chart: P('M3.5 20h17M6.5 16v-5M11.5 16V5.5M16.5 16V9'),
  sync: P('M19.5 11a7.5 7.5 0 0 0-13.9-3.5M4.5 13a7.5 7.5 0 0 0 13.9 3.5M19.5 4v4h-4M4.5 20v-4h4'),
  search: (
    <>
      {C(11, 11, 6.5)}
      {P('m20 20-4.2-4.2')}
    </>
  ),
  sliders: P('M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5'),
  camera: (
    <>
      {P('M4 8h3l1.8-2.5h6.4L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z')}
      {C(12, 13.3, 3.4)}
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      {C(9, 10, 1.5)}
      {P('m20.5 15.5-4.5-4.5-8.5 8.5')}
    </>
  ),
  close: P('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  trash: P('M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2l.9-12.5'),
  check: P('m5 12.5 4.5 4.5L19 7.5'),
  clock: (
    <>
      {C(12, 12, 8.5)}
      {P('M12 7.5V12l3 2')}
    </>
  ),
  alert: P('M12 4 2.8 19.5h18.4zM12 10v4.5M12 17h.01'),
  back: P('M14.5 5.5 8 12l6.5 6.5'),
  chevronLeft: P('M14.5 6 8.5 12l6 6'),
  chevronRight: P('m9.5 6 6 6-6 6'),
  logout: P('M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4.5'),
  bell: P('M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 1.5H5zM10 20.5h4'),
  download: P('M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M4.5 19.5h15'),
  clip: P('M19.5 11.5 12 19a4.6 4.6 0 0 1-6.5-6.5L13 5a3.2 3.2 0 0 1 4.5 4.5L10 17a1.8 1.8 0 0 1-2.6-2.6L14.5 7.4'),
  cloudOff: P('M3.5 3.5l17 17M8.5 7.2A5.5 5.5 0 0 1 17.4 10H18a3.7 3.7 0 0 1 2.1 6.7M16.5 18.5H7a4.5 4.5 0 0 1-1.6-8.7'),
  arrowUp: P('M12 19V5.5M6.5 11 12 5.5l5.5 5.5'),
  arrowDown: P('M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5'),
  user: (
    <>
      {C(12, 8.5, 3.7)}
      {P('M4.5 20a7.5 7.5 0 0 1 15 0')}
    </>
  ),

  share: P('M12 3.5v11M8 7l4-3.5L16 7M7 10.5H5.5v9h13v-9H17'),
  settings: (
    <>
      {C(12, 12, 3)}
      {P('M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z')}
    </>
  ),
  sun: (
    <>
      {C(12, 12, 4)}
      {P('M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4')}
    </>
  ),
  moon: P('M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'),
  monitor: P('M3.5 5h17v11h-17zM9 20h6M12 16v4'),
  shield: P('M12 3.5 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6zM9 12l2 2 4-4'),
  phone: P('M7.5 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2'),
  bolt: P('M13 3 5 13.5h6L10 21l8-10.5h-6z'),
  info: (
    <>
      {C(12, 12, 8.5)}
      {P('M12 11v5M12 8h.01')}
    </>
  ),
  sparkle: P('M12 3c.8 4.3 2.7 6.2 7 7-4.3.8-6.2 2.7-7 7-.8-4.3-2.7-6.2-7-7 4.3-.8 6.2-2.7 7-7z'),

  // Categorías
  food: P('M7.5 3.5v8M5.5 3.5v5a2 2 0 0 0 4 0v-5M7.5 11.5v9M17 20.5v-17c-2 1-3.5 4-3.5 7.5H17'),
  transport: (
    <>
      <rect x="5" y="3.5" width="14" height="13.5" rx="3" />
      {P('M5 11h14M8 17v3M16 17v3M8.5 14h.01M15.5 14h.01')}
    </>
  ),
  housing: P('M4 10.5 12 4l8 6.5M6 9.2V20h12V9.2M10 20v-5h4v5'),
  education: P('M5 5.5A2 2 0 0 1 7 3.5h12v14H7a2 2 0 0 0-2 2zm0 14v1h14M9 7.5h6'),
  entertainment: P('M3.5 6h17v4a2 2 0 0 0 0 4v4h-17v-4a2 2 0 0 0 0-4zM14.5 6v2.5M14.5 10.8v2.4M14.5 15.5V18'),
  health: P('M20.5 9c0 5.4-8.5 11-8.5 11S3.5 14.4 3.5 9A4.3 4.3 0 0 1 12 6.6 4.3 4.3 0 0 1 20.5 9zM7 12.5h3l1.5-2 2 4 1.5-2h2'),
  utilities: P('M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2.2h5c0-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z'),
  shopping: P('M5 8h14l-1 12.5H6zM9 8V6.5a3 3 0 0 1 6 0V8'),
  other_expense: P('M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4zm0 0L12 12l8.5-4.5M12 12v8.5'),
  salary: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2" />
      {P('M9 7V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7M3.5 12.5h17')}
    </>
  ),
  freelance: P('M5.5 5.5h13v9.5h-13zM3 18.5h18'),
  investments: P('M3.5 17 9 11.5l4 4 7.5-7.5M15 8h5.5v5.5'),
  gifts: P('M4.5 11h15v9.5h-15zM3.5 7.5h17V11h-17zM12 7.5v13M12 7.5S10.5 3.8 8.2 4.3 8 7.5 12 7.5zm0 0s1.5-3.7 3.8-3.2.2 3.2-3.8 3.2z'),
  other_income: (
    <>
      {C(9.5, 9.5, 6)}
      {P('M15.6 9.9a6 6 0 1 1-5.7 5.7')}
    </>
  ),
};

export default function Icon({ name, size = 22, className, label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {ICONS[name] ?? C(12, 12, 3)}
    </svg>
  );
}

export function CategoryIcon({ id, size = 20 }) {
  return <Icon name={ICONS[id] ? id : 'other_expense'} size={size} />;
}
