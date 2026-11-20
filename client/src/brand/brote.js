/**
 * Brote · mascota de FinanTrack
 * Una semilla que germina: el ahorro que crece. Generador SVG puro (sin DOM), usado
 * por el componente <Brote/> en la app y por scripts/make-icons.js para los íconos.
 *
 * Estados de ánimo:
 *   happy      contento (por defecto)
 *   wave       saluda (bienvenida, instalar)
 *   celebrate  celebra (metas cumplidas, buen ahorro)
 *   worried    preocupado (cerca del límite, errores de sincronización)
 *   sad        triste (presupuesto superado)
 *   sleep      duerme (sin conexión)
 *   think      piensa (cargando, sincronizando)
 */

export const BROTE_COLORS = {
  bodyLight: '#3cc196',
  body: '#24a17e',
  bodyDark: '#1b7f63',
  belly: '#d3f2e5',
  leaf: '#9ad86f',
  leafDark: '#5fb85a',
  stem: '#4c9e4f',
  ink: '#1d2420',
  cheek: '#f6a48e',
  tongue: '#f07a6a',
  spark: '#f5c451',
  drop: '#8fd0f0',
};

export const MOODS = ['happy', 'wave', 'celebrate', 'worried', 'sad', 'sleep', 'think'];

const C = BROTE_COLORS;

function eyes(mood) {
  const open = (lx, ly, rx, ry, r = 1) => `
    <g class="brote-eyes">
      <ellipse cx="${lx}" cy="${ly}" rx="${5 * r}" ry="${6.5 * r}" fill="${C.ink}"/>
      <ellipse cx="${rx}" cy="${ry}" rx="${5 * r}" ry="${6.5 * r}" fill="${C.ink}"/>
      <circle cx="${lx + 1.8}" cy="${ly - 2.6}" r="${1.9 * r}" fill="#fff"/>
      <circle cx="${rx + 1.8}" cy="${ry - 2.6}" r="${1.9 * r}" fill="#fff"/>
    </g>`;
  const arcs = (d) => `<g fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round">${d}</g>`;
  switch (mood) {
    case 'celebrate':
      return arcs('<path d="M40 70 q6.5 -8 13 0"/><path d="M67 70 q6.5 -8 13 0"/>');
    case 'sleep':
      return arcs('<path d="M40 68 q6.5 5 13 0"/><path d="M67 68 q6.5 5 13 0"/>');
    case 'think':
      return `${open(48.5, 65, 74.5, 65, 0.95)}
        ${arcs('<path d="M67 54 q6 -4 12 -1"/>')}`;
    case 'worried':
    case 'sad':
      return `${open(47, 69, 73, 69, mood === 'sad' ? 0.9 : 1)}
        ${arcs('<path d="M39 59 L51 55.5"/><path d="M81 59 L69 55.5"/>')}`;
    default:
      return open(47, 68, 73, 68);
  }
}

function mouth(mood) {
  const stroke = (d) => `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`;
  const open = `<path d="M51 79 Q60 92 69 79 Z" fill="${C.ink}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="60" cy="85.3" rx="4.6" ry="2.4" fill="${C.tongue}"/>`;
  switch (mood) {
    case 'wave':
    case 'celebrate':
      return open;
    case 'worried':
      return stroke('M51 84 q4.5 -3.5 9 0 t9 0');
    case 'sad':
      return stroke('M52 86 Q60 79 68 86');
    case 'sleep':
      return `<ellipse cx="60" cy="82" rx="2.8" ry="3.2" fill="${C.ink}"/>`;
    case 'think':
      return stroke('M55 83 Q61 81 66 83');
    default:
      return stroke('M52 80 Q60 88 68 80');
  }
}

function arms(mood) {
  const arm = (d, cls = '') => `<path class="${cls}" d="${d}" fill="none" stroke="${C.body}" stroke-width="8" stroke-linecap="round"/>`;
  if (mood === 'wave') return arm('M27 80 q-7 6 -4 13') + arm('M93 74 q11 -6 10 -19', 'brote-wave');
  if (mood === 'celebrate') return arm('M28 70 q-10 -6 -9 -20', 'brote-cheer') + arm('M92 70 q10 -6 9 -20', 'brote-cheer brote-cheer-r');
  if (mood === 'think') return arm('M27 80 q-7 6 -4 13') + arm('M90 82 q-6 2 -14 -1');
  if (mood === 'sad') return arm('M28 84 q-4 7 0 12') + arm('M92 84 q4 7 0 12');
  return arm('M27 80 q-7 6 -4 13') + arm('M93 80 q7 6 4 13');
}

function extras(mood) {
  const star = (x, y, s, delay) =>
    `<path class="brote-spark" style="animation-delay:${delay}s" transform="translate(${x} ${y}) scale(${s})" d="M0 -6 C1 -1.5 1.5 -1 6 0 C1.5 1 1 1.5 0 6 C-1 1.5 -1.5 1 -6 0 C-1.5 -1 -1 -1.5 0 -6Z" fill="${C.spark}"/>`;
  switch (mood) {
    case 'celebrate':
      return star(16, 36, 1, 0) + star(104, 30, 1.2, 0.4) + star(108, 62, 0.8, 0.8) + star(12, 66, 0.7, 0.2);
    case 'worried':
    case 'sad':
      return `<path class="brote-drop" d="M94 50 q5 7 0 10.5 q-5 -3.5 0 -10.5z" fill="${C.drop}"/>`;
    case 'sleep':
      return `<g class="brote-z" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".7">
        <path d="M95 30 h8 l-8 9 h8"/><path d="M107 15 h6 l-6 7 h6" stroke-width="2"/></g>`;
    case 'think':
      return `<g class="brote-dots" fill="${C.ink}" opacity=".55"><circle cx="92" cy="42" r="2.2"/><circle cx="99" cy="34" r="2.8"/><circle cx="107" cy="24" r="3.4"/></g>`;
    default:
      return '';
  }
}

/**
 * @param {object} o
 * @param {string} [o.mood]
 * @param {boolean} [o.animated]
 * @param {string} [o.uid] sufijo único para los ids de gradiente
 * @param {boolean} [o.shadow]
 */
export function broteSvg({ mood = 'happy', animated = true, uid = 'b', shadow = true } = {}) {
  const m = MOODS.includes(mood) ? mood : 'happy';
  const g = `brote-g-${uid}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="brote brote-${m}${animated ? ' is-animated' : ''}">
  <defs>
    <radialGradient id="${g}" cx="0.36" cy="0.3" r="0.85">
      <stop offset="0" stop-color="${C.bodyLight}"/>
      <stop offset="0.6" stop-color="${C.body}"/>
      <stop offset="1" stop-color="${C.bodyDark}"/>
    </radialGradient>
  </defs>
  ${shadow ? '<ellipse class="brote-shadow" cx="60" cy="111" rx="27" ry="4" fill="#000" opacity=".1"/>' : ''}
  <g class="brote-bob">
    <ellipse cx="48" cy="105" rx="9.5" ry="5" fill="${C.bodyDark}"/>
    <ellipse cx="72" cy="105" rx="9.5" ry="5" fill="${C.bodyDark}"/>
    ${arms(m)}
    <path d="M60 33 C85 33 99 53 99 74 C99 95 83 107 60 107 C37 107 21 95 21 74 C21 53 35 33 60 33Z" fill="url(#${g})"/>
    <ellipse cx="60" cy="88" rx="23" ry="15" fill="${C.belly}" opacity=".85"/>
    <g class="brote-sprout">
      <path d="M60 35 C59.5 29 60 25 61.5 20" fill="none" stroke="${C.stem}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M60.5 27 C53 14 39 14 35 21 C42 31 54 32 60.5 27Z" fill="${C.leaf}"/>
      <path d="M61.5 21 C66 8 81 5 86 11 C81 22 70 26 61.5 21Z" fill="${C.leafDark}"/>
      <path d="M60 27 C52 22 45 20 39 21" fill="none" stroke="${C.leafDark}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
    </g>
    ${eyes(m)}
    <ellipse cx="37.5" cy="80" rx="6" ry="3.6" fill="${C.cheek}" opacity=".75"/>
    <ellipse cx="82.5" cy="80" rx="6" ry="3.6" fill="${C.cheek}" opacity=".75"/>
    ${mouth(m)}
  </g>
  ${extras(m)}
</svg>`;
}

/** Silueta monocroma (para el "badge" de las notificaciones de Android). */
export function broteSilhouette(color = '#fff') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <g fill="${color}">
    <path d="M60 33 C85 33 99 53 99 74 C99 95 83 107 60 107 C37 107 21 95 21 74 C21 53 35 33 60 33Z"/>
    <path d="M60.5 27 C53 14 39 14 35 21 C42 31 54 32 60.5 27Z"/>
    <path d="M61.5 21 C66 8 81 5 86 11 C81 22 70 26 61.5 21Z"/>
    <rect x="58.5" y="20" width="3.4" height="16" rx="1.7"/>
  </g>
</svg>`;
}
