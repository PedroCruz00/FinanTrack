import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const icon = (src, sizes, purpose = 'any') => ({ src, sizes, type: 'image/png', purpose });
const shortcutIcon = (name) => [{ src: `/icons/shortcut-${name}.png`, sizes: '96x96', type: 'image/png' }];

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // Service worker propio (src/sw.js): Background Sync, Share Target, Push, Periodic Sync…
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // El usuario decide cuándo actualizar (aviso "Hay una versión nueva")
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,svg}', 'icons/*.png'],
        // Las capturas solo las usa el diálogo de instalación: no hace falta precachearlas
        globIgnores: ['screenshots/**'],
      },
      manifest: {
        id: '/',
        name: 'FinanTrack · Finanzas personales',
        short_name: 'FinanTrack',
        description:
          'Registra ingresos y gastos, controla tus presupuestos y guarda las fotos de tus facturas. Funciona sin conexión.',
        lang: 'es-CO',
        dir: 'ltr',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#f5f3ee',
        theme_color: '#f5f3ee',
        categories: ['finance', 'productivity', 'utilities'],
        prefer_related_applications: false,
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        icons: [
          icon('/icons/icon-192.png', '192x192'),
          icon('/icons/icon-512.png', '512x512'),
          icon('/icons/maskable-192.png', '192x192', 'maskable'),
          icon('/icons/maskable-512.png', '512x512', 'maskable'),
          { src: '/icons/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        shortcuts: [
          { name: 'Registrar gasto', short_name: 'Gasto', url: '/transactions/new?source=shortcut', icons: shortcutIcon('expense') },
          { name: 'Registrar ingreso', short_name: 'Ingreso', url: '/transactions/new?type=income&source=shortcut', icons: shortcutIcon('income') },
          { name: 'Presupuestos', url: '/budgets?source=shortcut', icons: shortcutIcon('budgets') },
          { name: 'Reportes', url: '/reports?source=shortcut', icons: shortcutIcon('reports') },
        ],
        // "Compartir" una foto desde la galería → nuevo gasto con la factura adjunta
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', text: 'text', files: [{ name: 'receipt', accept: ['image/*'] }] },
        },
        screenshots: [
          { src: '/screenshots/inicio.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Tu balance del mes con Brote' },
          { src: '/screenshots/gasto.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Registra un gasto con su factura en segundos' },
          { src: '/screenshots/presupuestos.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Presupuestos con alertas' },
          { src: '/screenshots/reportes.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Reportes y comparación entre meses' },
          { src: '/screenshots/escritorio.png', sizes: '1440x900', type: 'image/png', form_factor: 'wide', label: 'FinanTrack en el escritorio' },
        ],
      },
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Separar dependencias grandes para que las actualizaciones de la app descarguen menos
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)/ },
            { name: 'dexie', test: /node_modules[\\/]dexie/ },
            { name: 'charts', test: /node_modules[\\/](chart\.js|react-chartjs-2|@kurkle)/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: { '/api': 'http://localhost:4000' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:4000' },
  },
});
