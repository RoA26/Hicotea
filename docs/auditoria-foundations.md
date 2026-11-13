# Auditoría Foundations (2026-11-12)

Alcance: reglas financieras del backend (`api/app/modelo`, `servicios`, `repos`, migraciones), cálculos de dinero en la web, sistema de temas y diseño, e infraestructura de animación. Las decisiones que salen de aquí están en [`decisiones-foundations.md`](decisiones-foundations.md).

**Cómo se verificó**: lectura completa del código financiero, suite existente (`uv run pytest`: **74 pruebas, todas pasan**) y una **sonda temporal** de integración contra PostgreSQL (borrada después; no queda en el repo) para reproducir H-01, H-02 y H-03. Los hallazgos marcados como *por lectura* no se reprodujeron en ejecución.

> **Estado 2026-11-12**: H-01, H-02, H-03, H-04, H-06 y H-07 están **resueltos**, con pruebas permanentes (`tests/integracion/test_integridad.py`, `test_concurrencia.py`, `test_ahorro.py`). H-05 y H-08 siguen siendo decisiones de Reportes y Compromisos. Ver [`decisiones-caparazon-calendario.md`](decisiones-caparazon-calendario.md).

Severidad: **Alta** = el usuario ve un saldo falso o pierde dinero de vista · **Media** = un número engañoso o una regla ambigua · **Baja** = un caso borde o de presentación · **Info** = una decisión de diseño que se debe tomar a conciencia.

---

## 1. Lo que está bien (se conserva)

| Regla | Dónde | Verificado |
|---|---|---|
| Montos `NUMERIC(14,2)` siempre positivos; el signo lo pone el tipo de movimiento | migración 0001, `CHECK (monto > 0)` | lectura + pruebas |
| `parsear()` acepta la forma colombiana ("85.000", "$ 85.000", "85.000,50"), rechaza más de 2 decimales, negativos y cero | `modelo/dinero.py` | pruebas unitarias |
| Saldos **calculados**, nunca guardados: `disponible = INGRESO + RETIRO − GASTO − APORTE`; `saldo cajita = APORTE + RENDIMIENTO + SALDO_INICIAL − RETIRO` | `repos/movimiento.py`, `repos/cajita.py` | lectura + sonda |
| `SALDO_INICIAL` y `RENDIMIENTO` no tocan el disponible (dinero que no salió de los ingresos registrados) | idem | lectura |
| Gasto pagado desde cajita = `GASTO` + `RETIRO` enlazado (`id_relacionado`, `ON DELETE CASCADE`): el disponible queda igual y baja la cajita | `servicios/movimientos.py` | pruebas |
| `ck_movimiento_tipo` y `ck_movimiento_coherencia` (ingreso/gasto ↔ categoría; operación ↔ cajita) | migración 0002 | lectura |
| RN-01: un solo producido por fuente y día (índice único parcial) | `uq_ingreso_diario_por_fuente` | pruebas |
| Reparto: la parte de cada cajita se redondea **hacia abajo** a pesos; la cajita resto recibe lo que sobra, incluido el redondeo; sin resto, el sobrante se queda en el disponible | `calculos.proponer_reparto` | pruebas |
| Reparto todo-o-nada y tope del disponible revalidado al confirmar | `servicios/cajitas.confirmar_reparto` + una transacción por petición (`db.py`) | pruebas |
| Suma de porcentajes ≤ 100 al crear, editar y reactivar; una sola cajita resto activa (índice único parcial) | `servicios/cajitas.py`, migración 0002 | pruebas |
| Fechas futuras rechazadas; "hoy" en `America/Bogota` | `modelo/reloj.py` | pruebas |
| Recurrentes nunca se registran solos; confirmar y avanzar fecha van en la misma transacción; mensual y anual con día ancla (31 → 28/29 → 31) | `servicios/recurrentes.py`, `enums.Periodicidad` | pruebas |

---

## 2. Hallazgos del backend

### H-01 · Alta · confirmado — Dinero oculto en una cajita desactivada

Una cajita solo se puede desactivar con saldo 0. Pero después **sí se puede eliminar** el retiro que la vació, o un gasto que se pagó desde ella (su retiro se borra en cascada). Su saldo reaparece, y como el tablero y `/saldo` solo suman las cajitas **activas**, ese dinero desaparece del total.

Sonda: ingreso 100.000 → aporte 40.000 → retiro 40.000 → desactivar → eliminar el retiro. **Total antes: 100.000; después: 60.000**. La cajita inactiva queda con 40.000, invisibles en el tablero.

- Dónde: `servicios/movimientos.eliminar` (no mira si la cajita está activa) y `servicios/tablero.saldo/construir` (`listar_activas`).
- Arreglo propuesto (sin tocar las reglas de cálculo): en `eliminar`, si el movimiento, o el retiro enlazado a un gasto, pertenece a una cajita inactiva, rechazarlo con "Activa la cajita X para eliminar este movimiento". Añadir una prueba de integración con este mismo escenario. **No aplicado**: cambia una regla de negocio y el propietario debe aprobarlo (ver D-F1).

### H-02 · Media · confirmado — El disponible puede quedar negativo

Eliminar o rebajar un ingreso ya repartido, o eliminar un retiro, deja el disponible por debajo de cero sin ningún aviso. Sonda: ingreso 100.000 → aporte 100.000 a una cajita → eliminar el ingreso → **disponible −100.000**. El reparto lo trata como 0 (`max(disp, 0)`), pero el tablero muestra el negativo.

- No es una corrupción (los saldos se recalculan bien), pero el estado no tiene explicación en la interfaz.
- Hay que decidir si se bloquea o se permite con un aviso (D-F2).

### H-03 · Media · confirmado — Varias metas sobre la misma cajita cuentan el mismo dinero

Dos metas de 500.000 sobre una cajita con 500.000 marcan las dos 100 % y "cumplida". Nada impide vincular más de una meta a una cajita. Esto afecta la decisión del Caparazón (D-C2).

### H-04 · Baja · por lectura — Validaciones de saldo sin bloqueo

Cada petición es una transacción `READ COMMITTED`. La validación (`saldo ≥ monto`, `disponible ≥ total`) y la inserción no bloquean filas, así que dos peticiones simultáneas pueden pasar la validación y dejar una cajita o el disponible en negativo. El riesgo real con pocos usuarios es el **doble envío** desde la web (ver F-02, ya corregido). Endurecimiento propuesto: `SELECT … FOR UPDATE` sobre la fila del usuario o un `pg_advisory_xact_lock(id_usuario)` al inicio de las operaciones de dinero.

### H-05 · Info — El balance del mes mezcla gastos pagados con ahorro

Un gasto pagado desde una cajita cuenta como gasto del mes (es correcto: es consumo), así que el **balance del mes** puede salir negativo aunque el disponible no baje. Hay que decidir cómo se presenta en Reportes y Wrapped (D-R2).

### H-06 · Baja · por lectura — Fuentes desactivadas fuera del desglose

`resumen_por_fuente` filtra `f.activa`. Los ingresos de una fuente desactivada siguen sumando en el mes, pero no aparecen en el desglose por fuente, y el desglose no cuadra con el total. Para Reportes conviene incluir las fuentes inactivas que tengan movimientos en el periodo.

### H-07 · Baja · por lectura — Gastos por categoría agrupados por nombre

`gastos_por_categoria` agrupa por `c.nombre`. Una categoría personal y un costo operativo con el mismo nombre (son únicos por *tipo*, no globalmente) se suman en una sola porción de la gráfica. Conviene agrupar por `c.id, c.nombre, c.tipo`.

### H-08 · Info — Quincenal = +15 días

`Periodicidad.QUINCENAL` suma 15 días, así que la fecha se corre frente a la quincena colombiana (día 15 y último día del mes). Hay que decidirlo en Compromisos (D-K2).

### H-09 · Info — Casos borde que funcionan como se diseñaron

- Un atajo de ingreso con fuente solo se puede usar una vez al día (RN-01). El mensaje lo explica.
- Un recurrente atrasado varios periodos avanza uno por confirmación.
- Al editar un gasto no se puede añadir ni quitar la cajita de origen (hay que eliminarlo y registrarlo de nuevo).
- `eliminar` valida el saldo de la cajita con el saldo **actual**, no con el cronológico. Es suficiente porque los saldos no se guardan.

---

## 3. Hallazgos de la web (cálculos y envío)

### F-01 · Alta · confirmado y **corregido** — 0,5 % se leía como 50 %

`porcentajeNumero` (`web/src/lib/formato.ts`) trataba los valores entre 0 y 1 como fracciones (×100). La API siempre usa la escala 0–100 (`NUMERIC(5,2)`, `CHECK 0..100`), así que una cajita de **0,5 %** se mostraba como 50 % en la barra del caparazón y en las listas. Lo grave: **el formulario de edición se precargaba con 50** (`Cajitas.tsx:129`), de modo que guardar sin mirar cambiaba la regla de reparto. Corrección: devolver el número tal cual, con un comentario que explica por qué.

### F-02 · Alta · confirmado y **corregido** — `Boton` no se desactivaba mientras cargaba

En `componentes/ui.tsx`, `disabled={cargando || p.disabled}` iba **antes** de `{...p}`, y el spread lo pisaba con `p.disabled`. El botón mostraba "Un momento…" pero seguía activo: doble clic = doble envío (dos aportes, dos repartos, dos gastos). Afecta a todos los formularios. Corrección: el spread va primero y `disabled` y `className` después; se añade `aria-busy`.

### F-03 · Media · confirmado y **corregido** — La suma en vivo de Repartir no leía como la API

`Reparto.tsx` sumaba quitando todos los puntos: "12.50" contaba como 1.250, y "$ 85.000" contaba como 0. Ahora `parsearMonto` (`lib/formato.ts`) replica `dinero.parsear` (miles con punto, decimal con coma, máximo 2 decimales, cero = omitido). Se probó con 14 entradas y coincide con la API en todas.

### F-04 · Baja — Los colores del caparazón ignoraban el tema elegido · **corregido**

Tailwind 4 aplica `dark:` según `prefers-color-scheme`, no según `data-theme`. Los segmentos `dark:bg-sky-500…` de `Cajitas.tsx` seguían al sistema operativo y no a la preferencia guardada. Se añadió `@custom-variant dark` en `tema/tokens.css`. Siguen siendo colores fuera de la paleta (ver §4.3).

---

## 4. Sistema de diseño (estado actual)

### 4.1 Tokens y consumo

`web/src/tema/tokens.css` define 12 tokens de color en español y los expone a Tailwind (`bg-acento`, `text-gasto`…) con `@theme inline`. Usos en `.tsx`: `texto-suave` 85, `borde` 54, `gasto` 44, `acento` 47, `superficie` 40, `superficie-2` 21, `aviso` 15, `ingreso` 11, `sobre-acento` 7, `acento-vivo` 4, `fondo` 2. **La adopción es muy alta**: casi no hay colores escritos a mano.

No hay tokens de **radio, sombra, tipografía, duración ni curva**. Los radios están fijos en las clases (`rounded-2xl` ×18, `rounded-xl` ×16, `rounded-full` ×16) y las curvas están en `index.css`.

### 4.2 Colores escritos directamente

| Dónde | Qué | Valoración |
|---|---|---|
| `componentes/Marca.tsx` | hex del logo | **Intencional**: el símbolo es igual en ambos temas (kit de identidad) |
| `animacion/ParticulasLanding.tsx` | `#34D399`/`#A3E635` y `rgba(...)` | Se conserva. Si las paletas llegan a la landing, leer `--acento`/`--acento-vivo` con `getComputedStyle` |
| `paginas/Cajitas.tsx:38-46` | `sky/amber/purple/emerald/teal` de Tailwind | **A tokenizar**: el ámbar choca con el significado de `--aviso` y ninguno pasa por la paleta |
| `Modal.tsx`, `Marco.tsx` | `bg-black/60` (velo) | Aceptable; posible token `--velo` |

### 4.3 Claro y oscuro, y persistencia

- El oscuro va por defecto; el claro usa `data-theme="light"` en `<html>`. `color-scheme` se ajusta en `index.css`.
- Persistencia: `localStorage['hicotea:tema'] = 'claro' | 'oscuro'` (`tema/tema.ts`). Un script en línea en `index.html` lo aplica **antes de pintar** (sin destello), y `<meta theme-color>` se actualiza al alternar.
- No sigue al sistema la primera vez: sin preferencia guardada siempre arranca en oscuro.

### 4.4 Gráficas

`componentes/Graficas.tsx` dibuja SVG a mano con tokens. El gasto lleva **textura rayada** (`repeating-linear-gradient` con `--gasto`), tal como exige `CLAUDE.md` por daltonismo. Todas tienen leyenda y "Ver como tabla". No hay tokens de series para las categorías: el caparazón usa los colores de Tailwind de §4.2.

### 4.5 Formularios y estados semánticos

Las primitivas están en `componentes/ui.tsx`: `Boton` (4 variantes), `Campo`, `Entrada`, `EntradaMonto` (`inputMode=decimal`, 16 px para que iOS no haga zoom), `Selector`, `Interruptor`, `Segmentos`, `AlertaError`/`AlertaExito`, `Insignia`, `Barra`, `Cifra` y `Monto`. El estado de error usa `aria-invalid:border-gasto`. Los tonos semánticos son siempre `acento | aviso | gasto` con el patrón `bg-x/10 border-x/30 text-x`. Es consistente y fácil de adaptar a varios estilos si los radios y las superficies pasan a tokens.

### 4.6 Tipografía

`body` pide `'Inter'`, pero **Inter no se carga** (no hay `@fontsource/inter`), así que en la práctica se usa la fuente del sistema. Plus Jakarta Sans 800 se sirve desde `@fontsource` solo para la marca.

---

## 5. Animación (estado actual)

| Pieza | Implementación | Evaluación |
|---|---|---|
| `ParticulasLanding.tsx` | Canvas 2D + rAF, ≤ 70 partículas, solo en la landing, se apaga con reduced-motion | **Se conserva** sin cambios |
| `index.css` | `modalEntrada` (260 ms), `fondoEntrada` (200 ms), `itemEscalonado` (240 ms); solo `transform`/`opacity`; bloque global de reduced-motion | **Se conserva**. Todo es composite-only |
| `TransicionPagina.tsx` | `key={pathname}` + `.anim-escalonado`; solo entrada | Se conserva. Para una salida hace falta `AnimatePresence` **y congelar el `Outlet` saliente** (`useOutlet()` guardado en una ref). Si no, la página que sale renderiza la ruta nueva o se desmonta antes de tiempo. Un formulario a medio llenar se desmonta igual que hoy (no hay persistencia de borradores), así que la salida no empeora eso, pero alarga el desmontaje unos 150 ms |
| `ContadorAnimado.tsx` | Antes: rAF + `setState` por frame (≈ 27 renders por animación, 3 contadores a la vez en el tablero). **Ahora**: `animate()` de Motion escribiendo en el DOM, sin renders por frame, interrumpible desde la cifra visible y con Motion cargado bajo demanda | No se midió un problema de rendimiento; el cambio responde a arquitectura (primera integración de Motion), no a jank observado |
| Modal | Solo entrada CSS; al cerrar desaparece de golpe | Candidato a `AnimatePresence` + spring (lo pide `CLAUDE.md`), en una sesión aparte |

**Motion**: se instaló `motion@14.7.1` (MIT, peers React ^18 || ^19, publicado el 2026-10-27; la última, 14.13.0, salió hoy y se descartó por prudencia). Costo medido: `animate()` pesa **≈ 24 kB gzip**. Con carga diferida, el paquete inicial pasa de 112,2 a 112,9 kB gzip y Motion va en un fragmento aparte que el service worker precachea (funciona sin conexión). **Lenis no se instaló.**
