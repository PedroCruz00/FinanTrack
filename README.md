# FinanTrack

Aplicación web progresiva (PWA) de finanzas personales: registra ingresos y gastos, controla presupuestos con alertas, guarda fotos de facturas y funciona sin conexión, con sincronización confiable al servidor.

**Stack:** React + Vite · vite-plugin-pwa (Workbox) · Dexie (IndexedDB) · Chart.js · Node.js + Express · MySQL

## Puesta en marcha

Requisitos: Node 20 o superior y MySQL 8 o superior (en macOS: `brew install mysql`).

### 1. Instalar (solo la primera vez)

```bash
brew services start mysql              # MySQL encendido
npm run install:all                    # dependencias del servidor y del cliente
cp server/.env.example server/.env     # archivo de configuración
```

### 2. Completar `server/.env`

| Variable | Valor | Cómo obtenerlo |
|---|---|---|
| `PORT` | `4000` | Déjalo así. Si lo cambias, también el proxy en `client/vite.config.js`. |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL local por defecto. |
| `DB_USER` | `root` | El usuario con el que entras a MySQL. |
| `DB_PASSWORD` | vacío o tu contraseña | Con Homebrew, `root` no trae contraseña. Compruébalo abajo. |
| `DB_NAME` | `finantrack` | Se crea sola con `npm run migrate`. |
| `JWT_SECRET` | cadena aleatoria | `openssl rand -hex 32` |
| `UPLOAD_DIR` | `uploads` | Carpeta de las fotos de facturas (`server/uploads`). |
| `CORS_ORIGIN` | `http://localhost:5173` | Dirección del cliente en desarrollo. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | par de claves | `cd server && npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:tu-correo` | Un correo de contacto para los servicios push. |

**Contraseña de MySQL.** Si `mysql -uroot -e "select 1"` funciona, deja `DB_PASSWORD=` vacío. Si necesitas `mysql -uroot -p`, escribe esa contraseña.

**JWT_SECRET** (firma las sesiones). Para generarlo y guardarlo directamente en el archivo:

```bash
sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" server/.env
```

**Claves VAPID** (notificaciones push):

```bash
cd server && npx web-push generate-vapid-keys && cd ..
```

Copia `Public Key` en `VAPID_PUBLIC_KEY` y `Private Key` en `VAPID_PRIVATE_KEY`.

> Genera las claves VAPID **una sola vez**: si las cambias, las suscripciones push existentes dejan de funcionar.
> Sin ellas la app funciona igual; solo se desactiva el push del servidor (las alertas locales siguen activas).

> `server/.env` contiene secretos y está excluido de git: **nunca lo subas**. Cada integrante genera los suyos con estos pasos.

### 3. Crear la base de datos

```bash
npm run migrate     # → Base de datos "finantrack" lista (14 categorías).
```

### 4. Correr la app

**Versión de producción** (recomendada para probar la PWA y presentar), en dos terminales:

```bash
npm run dev:server                   # Terminal 1 → API en http://localhost:4000
npm run build && npm run preview     # Terminal 2 → App en http://localhost:4173
```

**Modo desarrollo** (se recarga al guardar cambios):

```bash
npm run dev:server     # Terminal 1
npm run dev:client     # Terminal 2 → http://localhost:5173
```

**Pruebas de la API** (con la API encendida): `npm test`

### Comandos útiles

```bash
pkill -f "src/index.js"; pkill -f "vite preview"            # detener servidores en segundo plano
mysql -uroot -e "DROP DATABASE finantrack" && npm run migrate  # reiniciar la BD (borra todo)
npm --prefix client run icons                                # regenerar íconos desde Brote
```

### Probar en el celular

El service worker, la instalación, las notificaciones y la cámara exigen HTTPS (o `localhost`). Usa un túnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:4173
```

Abre en el teléfono la dirección `https://…trycloudflare.com` que imprime el túnel y elige «Instalar».

## Identidad: Libreta + Brote

**Brote** es la mascota: una semilla que germina, el ahorro que crece. Es un SVG propio con 7 estados de ánimo (saluda, contento, celebra, piensa, preocupado, triste, duerme) y comenta tu situación en la pantalla de inicio: celebra si ahorras, se preocupa cerca de un límite y duerme cuando no hay conexión. Los íconos de la app se generan a partir de él (`npm --prefix client run icons`).

El sistema visual **«Libreta»** usa papel cálido, tinta oscura, cifras en serif (Instrument Serif), interfaz en Manrope y un único acento jade. Las fuentes van autoalojadas y hay tema claro, oscuro o del sistema.
Las reglas están en [.claude/skills/minimal-mobile-ui/SKILL.md](.claude/skills/minimal-mobile-ui/SKILL.md).

## Capacidades PWA

| Capacidad | Implementación | Cómo probarla |
|---|---|---|
| Instalación | Manifiesto completo (`id`, íconos `any` + `maskable`, `display_override`, `launch_handler`, capturas `narrow`/`wide`, categorías) e invitación propia con `beforeinstallprompt`; instrucciones en iOS | Chrome/Edge → «Instalar app» en Inicio o Ajustes |
| Funciona sin conexión | Service worker propio (`src/sw.js`, Workbox injectManifest): precaché del app shell y navegación offline. Los datos viven en IndexedDB | DevTools → Network → Offline y recarga |
| Actualizaciones | `registerType: 'prompt'`: aviso «Hay una versión nueva» y el usuario decide; búsqueda cada hora | Recompila y vuelve a la pestaña |
| Background Sync | Cada cambio registra `outbox-sync`; con la app **cerrada**, el SW envía la cola al volver la red | Guarda un gasto sin red, cierra la pestaña y reconecta |
| Periodic Background Sync | `daily-check`: recordatorio a las 6 p. m. si no hay gastos del día, alertas de presupuesto y aviso de facturas sin subir | App instalada en Chrome |
| Notificaciones locales | Alertas al llegar al % configurado y al 100 %, una vez por período; sin servidor | Crea un presupuesto bajo y registra un gasto |
| Web Push | VAPID + `web-push`; resumen semanal (lunes 8:00), prueba desde Ajustes; renovación con `pushsubscriptionchange` | Ajustes → Notificaciones push → Enviar prueba |
| Compartir hacia la app | `share_target`: compartir una foto desde la galería abre un gasto nuevo con la factura adjunta | Android con la app instalada → Compartir → FinanTrack |
| Compartir desde la app | Web Share API: resumen del mes y CSV como archivo | Reportes → Compartir |
| Atajos | 4 `shortcuts` (gasto, ingreso, presupuestos, reportes) | Mantén presionado el ícono instalado |
| Insignia | Badging API con el número de cambios pendientes | Ícono instalado con cambios sin sincronizar |
| Concurrencia | Web Locks: nunca sincronizan a la vez dos pestañas ni la pestaña y el SW | — |
| Almacenamiento | `navigator.storage.persist()` y uso en Ajustes | Ajustes → Datos |
| Diagnóstico | Ajustes → «Capacidades PWA de este navegador» detecta en vivo qué está disponible | — |

Todo usa detección de soporte: si un navegador no ofrece algo (por ejemplo, Safari sin Background Sync), la app sigue funcionando con los disparadores de la página.

**Para la presentación:** en la bienvenida o en Ajustes, elige «Cargar datos de ejemplo» para tener cuatro meses de movimientos y presupuestos.

## Estructura

```
server/
  src/schema.sql          Modelo relacional (users, categories, transactions, budgets, receipts, processed_operations)
  src/migrate.js          Crea la BD y carga las categorías
  src/routes/auth.js      Registro / login (bcrypt + JWT)
  src/routes/sync.js      POST /sync/push (cola de operaciones) · GET /sync/pull (cambios desde una fecha)
  src/routes/receipts.js  Subida idempotente de facturas y descarga protegida
  src/routes/push.js      Web Push: clave VAPID, suscripción, prueba y resumen
  src/push.js             Envío de push y programador del resumen semanal
  test/api.test.js        Pruebas de integración
client/
  src/lib/db.js           Esquema IndexedDB (Dexie), incluida la cola "outbox"
  src/lib/repo.js         Escrituras locales: registro + operación en cola en una sola transacción
  src/sw.js               Service worker: precaché, Share Target, Background/Periodic Sync, Push
  src/brand/brote.js      Mascota Brote (SVG con 7 estados), fuente de los íconos
  src/lib/sync-core.js    Núcleo de sincronización (push/pull, reintentos, Web Locks), compartido con el SW
  src/lib/sync.js         Disparadores y estado de la sincronización en la página
  src/lib/pwa.js          Instalación, Background/Periodic Sync, Web Push, tema, almacenamiento
  src/lib/coach.js        Qué dice Brote según tus finanzas
  src/lib/budgets.js      Períodos, consumo, historial y alertas locales
  src/lib/image.js        Compresión de fotos y hash SHA-256
  src/pages/              Inicio, Movimientos, Formulario, Presupuestos, Reportes, Sincronización, Ajustes
  scripts/make-icons.js   Genera todos los íconos PNG a partir de Brote
```

## Cómo se cumple cada requisito

| Requisito del documento | Implementación |
|---|---|
| Registro de ingresos y gastos, categorías, fecha, valor, descripción, método de pago | `TransactionForm.jsx`, `repo.saveTransaction` |
| Historial con edición y eliminación | `Transactions.jsx` (agrupado por día) |
| Balances diario, mensual y anual | Selector Hoy / Este mes / Este año en `Dashboard.jsx` |
| Presupuestos generales o por categoría, % consumido y saldo disponible | `Budgets.jsx`, `budgets.budgetStatus` |
| Alerta al % configurable y al 100 % | `budgets.checkBudgetAlerts` (local, una vez por umbral y período) + Notifications API |
| Reinicio por período | El consumo se calcula siempre dentro del período vigente (semanal / mensual / anual) |
| Una o varias fotos por gasto, cámara o galería | `<input capture="environment">` y selector múltiple |
| Compresión de imágenes | Máx. 1600 px, JPEG al 72 % (`image.js`) |
| Búsqueda por fecha, categoría, establecimiento | Filtros y búsqueda por palabras clave en `Transactions.jsx` |
| Funcionar sin Internet | Service worker (caché de la app) + IndexedDB (datos) |
| Cola de operaciones pendientes | Tabla `outbox` en IndexedDB |
| Estado por registro: sincronizado / pendiente / error | `syncStatus` + `StatusBadge` + página Sincronización |
| Evitar duplicados | UUID generado en el dispositivo + `opId` por operación + tabla `processed_operations` |
| Edición en dos dispositivos | Gana la última escritura (`updatedAt`); una eliminación siempre gana |
| Conservar archivos hasta confirmar | La foto queda en IndexedDB; la operación solo sale de la cola con respuesta OK |
| Sincronizar al abrir, al reconectar y manualmente | `startSyncEngine` (también cada minuto y al volver a la pestaña) |
| Informes: ingresos vs. gastos, por categoría, comparación entre meses, top categorías, historial de presupuestos | `Reports.jsx` |
| Exportación CSV | Botones en Reportes (compatible con Excel en español) |
| Seguridad | bcrypt, JWT, aislamiento por usuario en cada consulta, validación con zod, verificación de tipo real de imagen, facturas servidas solo a su dueño, helmet |

## Flujo de sincronización

1. Cada cambio se guarda en IndexedDB con `syncStatus: 'pending'` y, **en la misma transacción**, se agrega una operación `{opId, entity, action, entityId, payload, updatedAt}` a la cola.
2. El motor envía la cola **en orden**: lotes JSON a `/sync/push` y cada factura como `multipart` a `/receipts`.
3. El servidor revisa `processed_operations`: si el `opId` ya existe, devuelve el resultado guardado sin aplicar nada (idempotencia).
4. Respuesta `ok` o `stale` → la operación sale de la cola y el registro pasa a `synced`. Error de red → se reintenta con espera exponencial. Error de validación → `error`, visible en la página Sincronización (reintentar o descartar).
5. Después se hace `/sync/pull?since=…` para traer los cambios de otros dispositivos. Los registros con operaciones aún en cola no se sobrescriben.

No se depende de Background Sync, porque su soporte varía entre navegadores.

## Próximos pasos

- Exportación a PDF y copia de seguridad completa con las facturas.
- Gastos recurrentes y recordatorios de vencimiento.
- OCR de facturas (p. ej. Tesseract.js) para prellenar valor, fecha y establecimiento.
- Categorías personalizadas por usuario.
