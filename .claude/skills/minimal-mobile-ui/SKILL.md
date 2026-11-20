---
name: minimal-mobile-ui
description: Identidad visual de FinanTrack — sistema "Libreta" (minimalista, mobile-first) y la mascota Brote. Usar SIEMPRE antes de crear o modificar pantallas, componentes, estilos, íconos, ilustraciones o gráficas del cliente (client/src).
---

# Libreta + Brote · identidad de FinanTrack

La app se siente como una libreta de cuentas bien cuidada (papel cálido, tinta oscura, números
protagonistas) acompañada por **Brote**, una semilla que germina: el ahorro que crece. La libreta
pone el orden; Brote pone la calidez.

## Principios

1. **Contenido sobre contenedores.** Las secciones viven sobre el papel, separadas por espacio
   (24–32 px) y líneas de 1 px `--line`. Las únicas superficies con fondo son: hojas (sheets),
   campos, dock, y las **tarjetas de Brote** (`.coach`, `.install-card`).
2. **Los números son el héroe.** Montos grandes en serif (`--font-num`, Instrument Serif), cifras
   tabulares. Una pantalla = una cifra principal.
3. **Un acento, color con significado.** `--accent` (jade) para acciones y valores positivos. Gastos
   en tinta. Estados (ok / warning / danger) siempre con ícono + texto.
4. **Pulgar primero.** Dock flotante inferior con "+" al centro; acciones primarias abajo; objetivos
   táctiles ≥ 44 px; margen lateral 20 px.
5. **Íconos lineales propios** (`components/Icon.jsx`, 24 px, trazo 1.75). Nada de emojis.
6. **Jerarquía con tipografía.** Manrope (solo latín, autoalojada) para UI; etiquetas de sección de
   13 px en `--ink-3`.
7. **Movimiento discreto.** 160–220 ms `cubic-bezier(.2,.8,.2,1)`. Brote se mueve (respira,
   parpadea, el brote se mece) pero nunca distrae. Todo se apaga con `prefers-reduced-motion`.
8. **Claro y oscuro de primera clase.** Tokens en `:root`; el oscuro se define para el sistema y
   para `[data-theme="dark"]` (selector de Ajustes). Brote mantiene sus colores en ambos.

## Brote (mascota)

- Fuente única: `src/brand/brote.js` (`broteSvg()`), usada por `<Brote/>` y por
  `scripts/make-icons.js` (íconos de la app). Si cambias a Brote, regenera con `npm run icons`.
- Estados y cuándo usarlos:

| mood | Uso |
|---|---|
| `wave` | Bienvenida, login, invitación a instalar, lista vacía |
| `happy` | Por defecto, consejos |
| `celebrate` | Buen ahorro, todo sincronizado, nueva versión |
| `think` | Cargando, sincronizando, sugerencias, búsqueda sin resultados |
| `worried` | Presupuesto cerca del límite, errores de sincronización, sesión expirada |
| `sad` | Presupuesto superado |
| `sleep` | Sin conexión |

- Brote **habla en primera persona**, en tono cercano y breve ("Te aviso si…", "Guardo todo aquí").
- Tamaños: 36–44 px en avisos, 72–96 px en tarjetas, 120–170 px en estados vacíos y bienvenida.
- `label` solo cuando aporta información (lectores de pantalla); si no, es decorativo.

## Tokens (styles.css)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--paper` | `#f5f3ee` | `#121211` | Fondo |
| `--sheet` | `#fbfaf7` | `#1b1b19` | Hojas, campos, dock |
| `--ink` / `--ink-2` / `--ink-3` | `#1a1a17` / `#5f5d55` / `#8c8a80` | `#edebe5` / `#b5b2a8` / `#85837a` | Texto |
| `--line` | `#e4e1d8` | `#2a2a27` | Separadores |
| `--accent` | `#1f8a70` | `#3fb895` | Acción, positivo |
| `--mint` | `#e3f4ec` | `#16261f` | Fondo de tarjetas de Brote |
| `--sun` / `--peach` | `#f5c451` / `#f6a48e` | igual | Destellos y mejillas de Brote (no para UI) |
| `--chart-income` / `--chart-expense` | `#1f8a70` / `#d4683a` | `#1f9a7c` / `#d9692e` | Gráficas (validadas CVD) |

Radios: 12 px campos, 20–24 px hojas y tarjetas, 999 px píldoras. Espaciado en múltiplos de 4.

## Patrones

- **Tarjeta de Brote** (`CoachCard`): Brote 84 px + título 16 px + texto + CTA píldora tinta.
  El fondo cambia con el ánimo (mint, warn-soft, danger-soft, sheet).
- **Hero de cifra**: etiqueta 13 px → monto serif 52–64 px → ingresos/gastos con flechas.
- **Fila de lista**: ícono en círculo de 42 px · título / meta (la fecha primero) · monto.
- **Pestañas de texto**, **bottom sheet**, **anillo de progreso**, **formulario de movimiento**
  (tipo → monto gigante → grilla de categorías → campos con línea → facturas → barra fija).

## Gráficas

Seguir el skill `dataviz`. En claro la pareja ingresos/gastos queda en la banda CVD 6–8: leyenda
siempre visible y 2 px de separación entre barras. Ejes y rejilla en `--line`, texto en `--ink-3`.

## Checklist

- [ ] ¿360 px sin scroll horizontal? ¿Acción primaria al alcance del pulgar?
- [ ] ¿Colores solo de tokens? ¿Cero emojis?
- [ ] ¿Estados con ícono + texto? ¿Brote con el ánimo correcto y mensaje en primera persona?
- [ ] ¿Modo oscuro (sistema y manual) revisado?
- [ ] ¿Animaciones apagadas con reduced-motion?
