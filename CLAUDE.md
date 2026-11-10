# Hicotea — Especificación (Eden 2)

App web personal de finanzas: fuentes de ingreso con sus costos, gastos, cajitas de ahorro, presupuestos, metas, recurrentes y atajos. Es la reescritura de **Eden** (github.com/RoA26/Eden: Spring Boot 3 + Thymeleaf + Alpine + PostgreSQL). Pocos usuarios (uso personal y de conocidos); prioridad: ligera en el VPS, rápida y bonita.

> Nombre: **Hicotea**, la tortuga del Caribe colombiano. Lleva su casa encima y avanza lenta pero segura, que es la idea de ahorrar. (Antes se llamaba "Shulker"; se cambió para no usar un término de Minecraft).

## Identidad

- **Logo final (símbolo 10B)**: tortuga hicotea de perfil cuyo caparazón son tres discos de moneda apilados y estriados; arriba, una moneda lima inclinada (−18°) entra por la ranura de una alcancía. Cabeza con pinta lima. Colores fijos: verde `#34D399`, lima `#A3E635`, discos `#16261F`/`#0E1A15`, contornos `#07100C`. Se ve igual en tema oscuro y claro.
- **Fuente de verdad** (`Identidad/`): la lámina `hicotea_kit_de_identidad_final(3).html` (símbolo, monocromo, maskable, wordmark, paleta y auditoría WCAG) y sus exportaciones: `s_mbolo_oficial_logo_svg.svg` (símbolo), `s_mbolo_monocromo_logo_mono_svg.svg`, `cono_maskable_pwa_logo_maskable_svg.svg`, `logo_con_nombre_logo_wordmark_svg.svg` y `variables_css_finales_tokens_css.md` (tokens).
- **Wordmark**: símbolo + "Hicotea." en **Plus Jakarta Sans 800** (servida desde `@fontsource`, sin Google Fonts, para el modo offline), con el punto en `--acento-vivo`. En la web: `componentes/Marca.tsx` (`<Wordmark>` en la landing, el menú lateral, la barra móvil y auth; `<Simbolo>` en el resto).
- **Íconos de la PWA**: `cd web && pnpm iconos` (`web/scripts/iconos.mjs`, con resvg, a partir del símbolo y el maskable oficiales) genera en `web/public/` `favicon.svg`, `favicon.ico` (32), `icono-192.png`, `icono-512.png`, `icono-maskable-512.png` (símbolo dentro de la zona segura del 80 %) y `apple-touch-icon.png` (180).

## Stack

| Capa | Eden (antes) | Hicotea |
|---|---|---|
| Frontend | Thymeleaf + Alpine.js + Tailwind | **Vite + React + TypeScript + Tailwind** (PWA) |
| Animación | — | **Motion** (ex Framer Motion) + **Lenis** (scroll suave) |
| Backend | Spring Boot 3 (Java) | **Python 3.12 + FastAPI** + Pydantic v2 |
| BD | PostgreSQL + Flyway | **PostgreSQL** (mismo esquema) + **Alembic** |
| Acceso a datos | JdbcClient | SQLAlchemy 2 Core (consultas explícitas, sin ORM pesado) |
| Auth | Spring Security (sesión + CSRF) | Cookie de sesión httpOnly + SameSite=Lax, hash **argon2** |
| Servidor | Caddy + Docker | Caddy (sirve `web/dist` y hace proxy de `/api` → uvicorn) + Docker |

## Estructura del repo

```
hicotea/
├── CLAUDE.md           esta especificación (contexto para Claude Code)
├── Identidad/          kit de identidad final (lámina HTML, SVG exportados y tokens)
├── api/                FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── seguridad/  sesión, hash, dependencia usuario_actual
│   │   ├── modelo/     dominio puro (Dinero, CalculadoraReparto, Frecuencia…)
│   │   ├── esquemas/   Pydantic (equivalen a los *Form / DTO de Eden)
│   │   ├── repos/      SQL por entidad
│   │   ├── servicios/  reglas de negocio + transacciones
│   │   └── rutas/      routers /api/...
│   ├── migraciones/    Alembic (V1–V5 de Eden portados con op.execute)
│   └── tests/
├── web/                React
│   └── src/{paginas,componentes,animacion,api,tema}
├── docker-compose.yml
└── Caddyfile
```

## Módulos a portar (desde Eden)

Tablas: `usuario`, `categoria`, `fuente_ingreso`, `movimiento`, `cajita`, `recurrente`, `presupuesto`, `meta`, `acceso_compartido`, `recuperacion_contrasena`, `atajo`. **Se conservan las restricciones CHECK** de `movimiento` (`ck_movimiento_tipo`, `ck_movimiento_coherencia`).

| Módulo | Pantallas | Lógica clave a preservar |
|---|---|---|
| Auth | login, registro, recuperar, restablecer | tokens de recuperación con expiración |
| Tablero (inicio) | resumen, gráficas, botones rápidos | `Tablero`, `ResumenSaldo`, `ResumenPeriodo`, totales por categoría/día/mes |
| Movimientos | lista (filtros, paginación), formulario, **producido del día** | coherencia tipo↔categoría↔cajita, `id_relacionado` (transferencias) |
| Fuentes de ingreso | lista | `ResumenFuente` (ingreso − costos) |
| Cajitas | lista, detalle, **reparto** | `CalculadoraReparto`, `PropuestaReparto`, `PropositoCajita` |
| Metas | lista, formulario | `ProgresoMeta` (el ahorro se gestiona desde aquí) |
| Presupuestos | lista | `EstadoPresupuesto` |
| Recurrentes | lista, formulario, confirmación | `Frecuencia`, `Periodicidad` |
| Categorías | lista | `TipoCategoria` |
| Compartir | lista | `acceso_compartido` |
| Calendario | mes | `MesCalendario`, `DiaCalendario` |
| Atajos | botones rápidos | `POST /api/atajos/{id}/usar` + "Deshacer" |
| Landing | `/` pública | quien tiene sesión va a `/inicio` |

Se mantiene de Eden: móvil primero, sin barra inferior, menú lateral (drawer en móvil, fijo desde `lg`), modal de confirmación global, tema claro/oscuro guardado, PWA con modo offline.

## Paleta (verde)

Tokens finales del kit (`Identidad/variables_css_finales_tokens_css.md`), como variables CSS en `web/src/tema/tokens.css`; Tailwind los consume (`bg-acento`, `text-ingreso`…). En la app el tema claro va con `data-theme="light"` (el kit usa `data-tema="claro"`).

| Token | Oscuro (por defecto) | Claro |
|---|---|---|
| `--fondo` | `#07100C` | `#F4FBF7` |
| `--superficie` | `#0E1A15` | `#FFFFFF` |
| `--superficie-2` | `#16261F` | `#E6F4ED` |
| `--borde` | `#223C30` | `#C5DFD3` |
| `--texto` | `#ECFDF5` | `#071912` |
| `--texto-suave` | `#94B2A5` | `#3E6052` |
| `--texto-sobre-acento` (texto de botones primarios) | `#07100C` | `#FFFFFF` |
| `--acento` (marca, botones, enlaces) | `#34D399` | `#047857` |
| `--acento-vivo` (brillos, partículas, punto del wordmark) | `#A3E635` | `#3F6212` |
| `--ingreso` (dinero que entra) | `#34D399` | `#047857` |
| `--gasto` | `#FB7185` | `#E11D48` |
| `--aviso` | `#FBBF24` | `#D97706` |

`--ingreso` hoy vale lo mismo que `--acento`, pero se usa para montos y series de ingreso: si se separan, basta con cambiar el token. Todos los pares críticos de texto superan WCAG AA (auditoría en el kit).

**Daltonismo en gráficas**: ingreso y gasto (verde y rojo) no se distinguen bien con deuteranopía/protanopía (ΔE 4.6 en oscuro, 7.3 en claro; la meta es ≥ 8). Por eso los gastos llevan **textura rayada** además del color, y toda gráfica tiene leyenda y "Ver como tabla". No quitar la textura aunque cambie la paleta sin volver a validar.

Idea visual: fondo casi negro con tinte verde y un degradado esmeralda→lima en la landing y en los números grandes.

## Animación (inspirada en antigravity.google)

- **Landing**: campo de partículas verdes que reacciona al cursor (canvas 2D; `react-three-fiber` solo si hace falta). Titular con entrada por palabras y scroll suave con Lenis.
- **App**: transiciones de página cortas (fade + desplazamiento 8px, unos 200 ms), modales con spring, saldo con contador animado y listas con entrada escalonada.
- **Reglas**: animar solo `transform` y `opacity`; respetar `prefers-reduced-motion`; la librería de partículas solo se carga en la landing.

## Reparto del trabajo

| Fase | Herramienta | Entregable |
|---|---|---|
| 0. Identidad ✅ | **Gem de Gemini** | logo final + paleta en `Identidad/` (integrados en la web) |
| 1. Esqueleto | Claude Code (terminal) | monorepo, Docker, BD con migraciones, auth funcionando |
| 2. Backend | Claude Code | todos los módulos portados + tests de las reglas clave |
| 3. Pantallas base | Claude Code | las vistas funcionales con la paleta, sin pulir |
| 4. Animaciones y pulido | **Antigravity** | landing con partículas, transiciones, microinteracciones |
| 5. Revisión y despliegue | Claude Code | bugs, despliegue en el VPS (Caddy) junto a Bastion |

Las tareas visuales repetitivas van a Gemini/Antigravity para guardar tokens de Claude para Bastion. En Claude Code: una sesión por fase, `/clear` entre fases, `/model` liviano para lo rutinario.
