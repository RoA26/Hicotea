# Decisiones: sistema de diseño, Natura y Caparazón visual (2026-11-12, sesión 3)

Continúa [`decisiones-foundations.md §6`](decisiones-foundations.md) y [`decisiones-caparazon-calendario.md`](decisiones-caparazon-calendario.md).

## 1. Cuatro ejes, centralizados

`web/src/tema/preferencias.ts` es la única fuente de verdad. `index.html` aplica lo mismo **antes del primer render**, así no hay destellos.

| Eje | Atributo en `<html>` | Valores | Clave en `localStorage` | Inválido → |
|---|---|---|---|---|
| Estilo | `data-estilo` (sin atributo = Original) | `original`, `natura` · `impact` y `rebel` preparados, **no elegibles** | `hicotea:estilo` | `original` |
| Apariencia | `data-theme` (`light` = claro) | `oscuro`, `claro`, **`sistema`** (sigue a `prefers-color-scheme` en vivo) | `hicotea:tema` (**compatible**: ya guardaba `claro`/`oscuro`) | `oscuro` |
| Paleta | `data-paleta` | Original: `hicotea` · Natura: `bosque`, `arena`, `terracota`, `salvia` | `hicotea:paleta` | la primera del estilo |
| Movimiento | `data-movimiento` (el **efectivo**) | `completo`, `sutil`, `reducido` · `prefers-reduced-motion` **siempre** fuerza `reducido` | `hicotea:movimiento` | `completo` |

- El selector está en el menú lateral, en **"Estilo y apariencia"** (`componentes/AjustesApariencia.tsx`). El botón rápido "Tema claro/oscuro" se conserva.
- `tema/tema.ts` queda como capa de compatibilidad (`useTema`).
- Las animaciones en JS (`ContadorAnimado`, `ParticulasLanding`) consultan `movimientoReducido()`, y el CSS apaga todo con `[data-movimiento='reducido']`, igual que la media query.
- Son preferencias **por dispositivo**: no son datos financieros y no viajan al servidor.

## 2. Tokens (en español; los valores por defecto son Original)

`web/src/tema/tokens.css`. Tailwind los expone así: `rounded-tarjeta`, `rounded-control`, `rounded-modal`, `rounded-insignia`, `shadow-tarjeta`, `shadow-elevada`, `bg-serie-1…6`, `font-titulo` y `font-cifra`.

| Grupo | Tokens |
|---|---|
| Forma | `--radio-tarjeta` (1rem = el antiguo `rounded-2xl`), `--radio-control` (0.75rem = `rounded-xl`), `--radio-modal` (1.5rem = `rounded-3xl`), `--radio-insignia`, `--borde-ancho` |
| Superficie | `--sombra-tarjeta` (en Original es una sombra nula válida, `0 0 #0000`, no `none`, para no anular los `ring-*`), `--sombra-elevada`, `--velo` (fondo de modal y cajón) |
| Tipografía | `--fuente-texto`, `--fuente-titulo` (h1 y h2), `--peso-titulo`, `--tracking-titulo`, `--fuente-cifra`, `--peso-cifra`, `--estilo-cifra` |
| Movimiento | `--duracion-corta/media/larga`, `--curva-salida`, `--curva-estandar`, `--desplazamiento-entrada` (las animaciones de `index.css` ya los usan con los mismos valores de antes) |
| Series | `--serie-1…6` + `--texto-sobre-serie`. Cada serie lleva **patrón** propio (rayas, puntos, horizontales, cuadrícula, verticales y liso) |
| Calendario | `--dia-sin-registros`, `--dia-compromiso`, `--dia-ahorro` |

**Migración sin regresión**: todas las clases `rounded-2xl`, `rounded-xl` y `rounded-3xl` de la app pasaron a `rounded-tarjeta`, `rounded-control` y `rounded-modal`. En Original los valores son idénticos (no hay cambio visual), y así Natura se aplica en todas las pantallas sin duplicar componentes. `Marca.tsx` (el logo) no se tocó.

## 3. Natura (primera dirección completa)

`web/src/tema/estilos/natura.css`:

- **Forma**: tarjetas de 22 px, controles de 14 px y modales de 28 px.
- **Superficie**: sombras suaves y cálidas.
- **Tipo**: titulares con serifa del sistema (`Iowan Old Style`, `Palatino`, `Georgia`), sin descargas y compatibles con el modo offline. Las cifras siguen en sans tabular para que se alineen.
- **Movimiento**: curvas más suaves, entradas de 6 px y duraciones algo más largas.
- **Combinaciones publicadas**: 4 paletas × claro y oscuro = **8**. Las paletas claras salen del Design Lab; las oscuras son nuevas (oliva y tierra profundos).

### Contraste (WCAG AA, 4,5:1)

Verificado con `node web/scripts/contraste.mjs` (datos en `web/scripts/contraste-paletas.json`). Se comprueban texto, texto suave, acento, texto sobre acento, ingreso, gasto, aviso y texto sobre cada serie:

| Combinación | Mínimo |
|---|---|
| Natura claro: bosque, arena, terracota, salvia | 5,18 · 5,14 · 5,40 · 4,92 ✓ |
| Natura oscuro: bosque, arena, terracota, salvia | 7,34 · 7,49 · 7,56 · 7,42 ✓ |
| Original oscuro | 6,63 ✓ |
| **Original claro** | ✗ `--aviso` `#D97706` sobre blanco = **3,19** (heredado del kit de identidad; pasa 3:1 en texto grande o UI, pero no en texto pequeño) |

**Pendiente del propietario**: decidir si `--aviso` en Original claro baja a `#B45309` (≈ 5:1). Es un token del kit, así que no se cambió sin autorización.

Daltonismo: en Natura, ingreso (oliva) y gasto (granate) se distinguen por luminosidad, y **el gasto conserva la textura rayada** en gráficas, como manda `CLAUDE.md`.

### IMPACT y REBEL

Están preparados: tienen entrada en `ESTILOS` (deshabilitada en el selector), paletas vacías y el mismo mecanismo de `data-estilo`. Para publicarlos hace falta su hoja en `tema/estilos/`, sus paletas, la auditoría de contraste y `disponible: true`. REBEL además necesitará variantes estructurales (`useEstilo()` → mapa estilo → componente), sin duplicar lógica.

## 4. Caparazón visual

| Decisión | Detalle |
|---|---|
| Navegación | Una sola entrada, **Caparazón** (`/caparazon`). `/cajitas` y `/metas` redirigen allí. Se conservan `/cajitas/:id` (detalle) y `/cajitas/reparto` (Repartir) para enlaces internos e historial. `/caparazon/historial` es nueva |
| Tortuga | SVG propio (`componentes/caparazon/Tortuga.tsx`) con **7 placas hexagonales iguales** (una central y seis alrededor). **No son proporcionales** y el texto lo dice. Cada placa lleva color de serie, patrón, inicial y número. Una placa sin saldo es gris con contorno discontinuo y la etiqueta "sin saldo". Las placas libres invitan a crear una cajita |
| Muchas cajitas | Sin límite. Con más de 7, la 7.ª placa es "+N" y abre la lista de las restantes; la lista accesible muestra **todas** |
| Ninguna cajita | La tortuga con placas libres y el estado vacío con acción |
| Proporción | Gráfica aparte (`ProporcionAhorro`): barra apilada **proporcional al saldo** más una tabla con el mismo dato |
| Tres métricas | `MetricasCajita`: 1) reparto (insignia, sin barra), 2) parte del ahorro (solo número), 3) progreso de la meta (**la única barra**) |
| Lista accesible | Las mismas acciones que el SVG: seleccionar, aportar, retirar y ver detalle |
| Selección | CSS (`transform: scale` + `transform-box: view-box`), sin Motion: es interrumpible, cuesta casi nada y no añade peso al paquete principal |
| Crear cajita + meta | `POST /cajitas` acepta `meta` opcional. Se crean **en la misma transacción** (`servicios/caparazon.py`); si la meta falla, no queda la cajita creada y el error llega con campos `meta_*` |
| Descripción | Nueva columna opcional `cajita.descripcion` (migración 0008) |
| Logro | Acción explícita **"Celebrar y guardar logro"** (`POST /metas/{id}/logro`), nunca automática. Guarda `cumplida_en` = **fecha de reconocimiento** y `alcanzada_en` = primera fecha en que el saldo acumulado llegó al objetivo, **calculada leyendo el historial** (no se modifican movimientos). Archiva la meta para liberar la cajita. **No mueve dinero** y el texto lo explica |
| Celebración | `Celebracion.tsx`: anuncio por `role="status"` y una moneda que aparece con Motion (`animate`, carga diferida, solo transform y opacity). Con movimiento reducido no se anima |
| Archivo | Bloque plegable con los logros (fechas de reconocimiento y de alcance), las cajitas archivadas y las metas pausadas |

## 5. Calendario: distribución

- El ancho útil pasa a `max-w-7xl` **solo** en `/calendario` y `/caparazon`; las demás pantallas siguen en `max-w-5xl`.
- En escritorio el reparto es **70/30** (`7fr / 3fr`, con el detalle de 18 rem como mínimo). El panel se puede plegar con `aria-expanded`, y la preferencia de plegado se guarda por dispositivo. El panel queda fijo (sticky) mientras se navega por las fechas. No hay modal de detalle.
- En móvil, el calendario va a ancho completo y el detalle debajo.
- **Celdas**: cifras compactas (85k) hasta `lg` y completas desde `xl`. El ahorro (◆) se ve desde `lg` y el primer compromiso desde `xl`. Las celdas son más altas en pantallas grandes.
- **Cabecera**: el título del mes es grande, hay un grupo ‹ Hoy › y un selector de mes y año.

## 6. Días sin actividad y recordatorio (C-04 / C-05, implementados)

- Migración **0009** con la tabla `dia_sin_actividad (id_usuario, fecha)` (PK), tal como estaba diseñada. Rutas: `PUT` y `DELETE /api/dias-sin-actividad/{fecha}`, ambas idempotentes.
- **Reglas**: no se aceptan fechas futuras, ni días anteriores al primer movimiento, ni días con movimientos. Usa `serializar_finanzas` para no competir con un registro simultáneo. Un movimiento posterior **tiene prioridad** y la fila se conserva por si ese movimiento se elimina.
- **Calendario**: `sin_actividad` (✓) reemplaza a `sin_registros` (○). En el detalle están "Marcar como día sin actividad" y "Deshacer".
- **Inicio** (`RecordatorioAyer`): aparece si `ayer_sin_registros` (lo calcula la API). Ofrece registrar ayer, usar un atajo con la fecha de ayer, "No hubo actividad" y "Descartar" (por dispositivo).
- **Ahorro retrospectivo (C-03b)**: desde el detalle del día se elige la cajita y se abre su formulario con `?operacion=&fecha=&volver=`.
