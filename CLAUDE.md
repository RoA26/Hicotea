# Hicotea — Especificación (Eden 2)

App web personal de finanzas: fuentes de ingreso con sus costos, gastos, cajitas de ahorro, presupuestos, metas, recurrentes y atajos. Es la reescritura de **Eden** (github.com/RoA26/Eden: Spring Boot 3 + Thymeleaf + Alpine + PostgreSQL). Pocos usuarios (uso personal y de conocidos); prioridad: ligera en el VPS, rápida y bonita.

> Nombre: **Hicotea**, la tortuga del Caribe colombiano. Lleva su casa encima y avanza lenta pero segura, que es la idea de ahorrar. (Antes se llamaba "Shulker"; se cambió para no usar un término de Minecraft).

## Identidad

- **Logo (borrador v1)**: tortuga verde de perfil; caparazón en domo con placas (cada placa es una cajita de ahorro) y un hexágono central lima (lo ahorrado). Colores: caparazón `#10B981`, líneas de las placas `#047857`, borde y patas `#059669`, cabeza `#34D399`, hexágono `#A3E635`.
- **Pendiente**: pulir el logo (versión final en SVG, monocromo, ícono maskable y favicon). Se trabajará con un Gem de Gemini dedicado (ver `claude/gem-identidad-visual.md`).

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

Tokens como variables CSS; Tailwind los consume.

| Token | Oscuro (por defecto) | Claro |
|---|---|---|
| `--fondo` | `#07100C` | `#F4F9F6` |
| `--superficie` | `#0E1A15` | `#FFFFFF` |
| `--superficie-2` | `#14231C` | `#EAF3EE` |
| `--borde` | `#1F3329` | `#D3E4DA` |
| `--texto` | `#E6F4EC` | `#0A1C14` |
| `--texto-suave` | `#8AA597` | `#4E6A5C` |
| `--acento` (marca / ingreso) | `#34D399` | `#059669` |
| `--acento-vivo` (brillos, partículas) | `#A3E635` | `#65A30D` |
| `--gasto` | `#FB7185` | `#E11D48` |
| `--aviso` | `#FBBF24` | `#D97706` |

Idea visual: fondo casi negro con tinte verde y un degradado esmeralda→lima en la landing y en los números grandes.

## Animación (inspirada en antigravity.google)

- **Landing**: campo de partículas verdes que reacciona al cursor (canvas 2D; `react-three-fiber` solo si hace falta). Titular con entrada por palabras y scroll suave con Lenis.
- **App**: transiciones de página cortas (fade + desplazamiento 8px, unos 200 ms), modales con spring, saldo con contador animado y listas con entrada escalonada.
- **Reglas**: animar solo `transform` y `opacity`; respetar `prefers-reduced-motion`; la librería de partículas solo se carga en la landing.

## Reparto del trabajo

| Fase | Herramienta | Entregable |
|---|---|---|
| 0. Identidad | **Gem de Gemini** | logo final + variantes de paleta en láminas HTML |
| 1. Esqueleto | Claude Code (terminal) | monorepo, Docker, BD con migraciones, auth funcionando |
| 2. Backend | Claude Code | todos los módulos portados + tests de las reglas clave |
| 3. Pantallas base | Claude Code | las vistas funcionales con la paleta, sin pulir |
| 4. Animaciones y pulido | **Antigravity** | landing con partículas, transiciones, microinteracciones |
| 5. Revisión y despliegue | Claude Code | bugs, despliegue en el VPS (Caddy) junto a Bastion |

Las tareas visuales repetitivas van a Gemini/Antigravity para guardar tokens de Claude para Bastion. En Claude Code: una sesión por fase, `/clear` entre fases, `/model` liviano para lo rutinario.
