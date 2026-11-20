// Genera todos los íconos de la PWA a partir de la mascota Brote (src/brand/brote.js).
// Uso: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { broteSvg, broteSilhouette } from '../src/brand/brote.js';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = `<defs><radialGradient id="bg" cx="0.5" cy="0.35" r="0.75">
  <stop offset="0" stop-color="#e6f5ee"/><stop offset="1" stop-color="#f3efe6"/></radialGradient></defs>`;

/** Brote incrustado en un lienzo cuadrado de 512 con el tamaño indicado (fracción del lienzo). */
function canvas({ scale, rounded, dy = 0 }) {
  const s = 512 * scale;
  const x = (512 - s) / 2;
  const y = (512 - s) / 2 + dy;
  const brote = broteSvg({ animated: false, uid: 'icon', shadow: true })
    .replace('<svg ', `<svg x="${x}" y="${y}" width="${s}" height="${s}" `);
  const bg = rounded
    ? '<rect width="512" height="512" rx="112" fill="url(#bg)"/>'
    : '<rect width="512" height="512" fill="url(#bg)"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${BG}${bg}${brote}</svg>`;
}

// Íconos de atajos (shortcuts del manifiesto): círculo de color con un trazo simple.
const SHORTCUT_PATHS = {
  expense: 'M12 5v14M5 12h14',
  income: 'M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5',
  budgets: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
  reports: 'M3.5 20h17M6.5 16v-5M11.5 16V5.5M16.5 16V9',
};
const shortcut = (d, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="48" fill="${bg}"/>
  <g transform="translate(24 24) scale(2)" fill="none" stroke="#1d2420" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>
</svg>`;

const png = (svg, size, name) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL(name, OUT)));

const any = canvas({ scale: 0.86, rounded: true, dy: 10 });
const maskable = canvas({ scale: 0.64, rounded: false, dy: 8 }); // dentro de la zona segura (círculo del 80 %)
const apple = canvas({ scale: 0.74, rounded: false, dy: 8 });

await Promise.all([
  png(any, 192, 'icon-192.png'),
  png(any, 512, 'icon-512.png'),
  png(maskable, 192, 'maskable-192.png'),
  png(maskable, 512, 'maskable-512.png'),
  png(apple, 180, 'apple-touch-icon.png'),
  png(any, 48, 'favicon-48.png'),
  png(broteSilhouette('#ffffff'), 96, 'badge-96.png'),
  png(shortcut(SHORTCUT_PATHS.expense, '#f6d9cc'), 96, 'shortcut-expense.png'),
  png(shortcut(SHORTCUT_PATHS.income, '#cdeedd'), 96, 'shortcut-income.png'),
  png(shortcut(SHORTCUT_PATHS.budgets, '#f8e7b5'), 96, 'shortcut-budgets.png'),
  png(shortcut(SHORTCUT_PATHS.reports, '#d9e6f7'), 96, 'shortcut-reports.png'),
]);
writeFileSync(new URL('favicon.svg', OUT), broteSvg({ animated: false, uid: 'fav', shadow: false }));
console.log('Íconos generados en client/public/icons/');
