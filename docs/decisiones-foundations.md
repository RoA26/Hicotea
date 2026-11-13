# Decisiones Foundations (2026-11-12)

Registro de decisiones de arquitectura. Cada una lleva un **estado**: ✅ decidido (aplicado o confirmado por el propietario) · 🟡 propuesto (hay recomendación y falta el visto bueno) · ⬜ abierto (hay que decidirlo antes de construir). Los hallazgos citados (H-xx, F-xx) están en [`auditoria-foundations.md`](auditoria-foundations.md).

---

## 1. Finanzas: correcciones que esperan visto bueno

> **Actualización 2026-11-12**: el propietario aprobó D-F1 a D-F4, D-C1 y D-C2, y están implementadas. El detalle está en [`decisiones-caparazon-calendario.md`](decisiones-caparazon-calendario.md). La tabla de abajo queda como registro de la propuesta original.

| Id | Decisión | Estado | Recomendación |
|---|---|---|---|
| D-F1 | Qué pasa al eliminar un movimiento de una cajita **desactivada** (H-01) | 🟡 | Rechazarlo con "Activa la cajita X para eliminar este movimiento", más una prueba de integración. La alternativa (sumar las cajitas inactivas en los totales) esconde el problema en vez de evitarlo |
| D-F2 | Disponible negativo (H-02) | ⬜ | **Permitirlo con un aviso** en el tablero ("Repartiste más de lo que entró: retira $X de tus cajitas"). Bloquear la eliminación de ingresos impediría corregir errores de captura |
| D-F3 | Bloqueo concurrente en operaciones de dinero (H-04) | 🟡 | `pg_advisory_xact_lock(id_usuario)` al inicio de aporte, retiro, reparto y gasto desde cajita. Es una línea por servicio y no cambia ninguna regla |
| D-F4 | Desglose por fuente con fuentes inactivas (H-06) y gastos por categoría agrupados por id (H-07) | 🟡 | Hacerlo junto con Reportes, que es donde se nota |

Ya aplicado en la web (sin cambiar reglas): F-01 (porcentajes), F-02 (doble envío), F-03 (suma de Repartir) y F-04 (`dark:`).

---

## 2. Caparazón

Hoy "caparazón" es solo la barra segmentada de porcentajes en `Cajitas.tsx`. La propuesta es convertirlo en el **concepto que agrupa el ahorro**: cajitas, metas y reparto.

| Id | Pregunta | Estado | Opciones y recomendación |
|---|---|---|---|
| D-C1 | ¿Qué es el Caparazón? | ⬜ | (a) Solo la visualización del reparto · (b) **la vista del dinero protegido**: total en cajitas, su distribución, metas encima y el reparto como acción. Recomendada: (b), sin tablas nuevas (todo sale de `cajita`, `meta` y `movimiento`) |
| D-C2 | ¿Cuántas metas por cajita? (H-03) | ⬜ | (a) **Una meta activa por cajita** (índice único parcial `meta(id_cajita) WHERE activa`), recomendada por ser simple y honesta · (b) varias metas con montos apartados (requiere una tabla de asignaciones) |
| D-C3 | Colores de los segmentos | 🟡 | Tokens de serie `--serie-1…6` por paleta, validados para daltonismo como las gráficas. Quitar `sky/amber/purple` de Tailwind (el ámbar se confunde con `--aviso`) |
| D-C4 | Cajitas inactivas en el Caparazón | 🟡 | Se muestran aparte ("Guardadas") y no suman en el total; con D-F1 su saldo siempre es 0 |

---

## 3. Presupuestos

Hoy `presupuesto` tiene un `monto_mensual` único por categoría, sin historial: cambiarlo reescribe todos los meses pasados.

| Id | Pregunta | Estado | Opciones y recomendación |
|---|---|---|---|
| D-P1 | ¿Historial de montos? | ⬜ | Necesario para que Reportes y Wrapped no mientan sobre meses pasados. Recomendado: columna `vigente_desde DATE` y una fila por cambio; el mes N usa la fila vigente más reciente con `vigente_desde ≤ fin de N`. La migración copia los presupuestos actuales con `vigente_desde = fecha de creación` o el primer día del mes actual |
| D-P2 | ¿Cuentan los gastos pagados desde una cajita? | ⬜ | Hoy **sí** (son `GASTO`). Recomendado: mantenerlo, porque el presupuesto mide consumo y no de dónde salió el dinero, y explicarlo en la interfaz |
| D-P3 | Umbral de alerta | 🟡 | Mantener el 80 % fijo (`UMBRAL_ALERTA`); solo hacerlo configurable si alguien lo pide |
| D-P4 | ¿Lo que sobra pasa al mes siguiente? | ⬜ | Recomendado: **no** en esta versión (complica el modelo y Reportes) |

---

## 4. Compromisos

Nombre propuesto para la evolución de **Recurrentes**: pagos e ingresos esperados (arriendo, servicios, cuotas). Se mantiene la regla de que **nunca se registran solos**.

| Id | Pregunta | Estado | Opciones y recomendación |
|---|---|---|---|
| D-K1 | ¿Compromisos reemplaza a Recurrentes o lo amplía? | ⬜ | Recomendado: **cambio de nombre en la interfaz** (la tabla `recurrente` se queda igual) y, después, deudas con saldo pendiente como tipo aparte |
| D-K2 | Quincenal (H-08) | ⬜ | (a) Mantener +15 días · (b) **quincena colombiana**: días 15 y último del mes, como `Periodicidad.QUINCENA_CO` nueva sin romper la actual. Recomendada: (b) para salarios y arriendos |
| D-K3 | "Disponible libre" | ⬜ | Disponible menos los compromisos de gasto pendientes hasta fin de mes. Es solo una cifra derivada, no una regla. Útil antes de repartir |
| D-K4 | ¿Confirmar varios periodos atrasados de una vez? | 🟡 | No por ahora: cada confirmación pide el monto real |

---

## 5. Reportes

Es la base de Wrapped. **Sin Reportes fiables no hay Wrapped.**

| Id | Pregunta | Estado | Opciones y recomendación |
|---|---|---|---|
| D-R1 | Periodo | 🟡 | Mes calendario en `America/Bogota` (igual que el tablero). Años = agregación de meses |
| D-R2 | Cómo presentar el balance (H-05) | ⬜ | Recomendado: dos cifras. **Resultado del mes** (ingresos − gastos) y **movimiento del ahorro** (aportes − retiros, más rendimientos aparte). Así un mes que gastó ahorro se ve como tal y no como "pérdida" |
| D-R3 | ¿Calcular siempre o congelar meses? | ⬜ | Recomendado: **calcular siempre** (los saldos ya se calculan) y guardar solo una *huella* (`hash` de los totales) al generar un Wrapped, para avisar "este mes cambió desde tu resumen" |
| D-R4 | Contrato | 🟡 | `GET /api/reportes/mes?mes=YYYY-MM` → ver §8.1. El mismo servicio alimenta Reportes y Wrapped |
| D-R5 | Fuentes inactivas y categorías homónimas | 🟡 | Ver D-F4 |

---

## 6. Sistema de diseño: cuatro ejes independientes

El Design Lab (`docs/prototipos/hicotea-design-lab.html`) es una **referencia artística**, no un contrato técnico. Sus variables en inglés (`--bg`, `--surface`…) **no se adoptan**: se conservan los tokens en español de `tema/tokens.css`.

| Eje | Qué controla | Atributo en `<html>` | Valores | Persistencia (`localStorage`) |
|---|---|---|---|---|
| **Estilo artístico** | estructura y carácter: radios, densidad, tipografía de cifras, bordes, sombras y variantes de componentes | `data-estilo` | `original` (por defecto, sin atributo) · `natura` · `impact` · `rebel` | `hicotea:estilo` |
| **Apariencia** | claro u oscuro | `data-theme` (**se conserva**) | sin atributo = oscuro · `light` | `hicotea:tema` (**se conserva**: `claro`/`oscuro`) |
| **Paleta** | matiz de acento y series | `data-paleta` | `hicotea` (por defecto) + predefinidas por estilo | `hicotea:paleta` |
| **Movimiento** | intensidad de la animación | `data-movimiento` | `completo` · `sutil` · `reducido` (+ siempre manda `prefers-reduced-motion`) | `hicotea:movimiento` |

Reglas:

1. **Capas de tokens.** `tokens.css` sigue siendo la base (apariencia × paleta Hicotea). Las paletas solo redefinen `--acento`, `--acento-vivo`, `--ingreso` y `--serie-*`, nunca `--gasto` ni `--aviso` sin volver a validar el daltonismo. Los estilos añaden tokens **nuevos** de forma: `--radio-tarjeta`, `--radio-control`, `--borde-ancho`, `--sombra-tarjeta`, `--fuente-cifra`, `--peso-cifra`. Los defaults reproducen exactamente la interfaz actual (`rounded-2xl` = 1rem, `rounded-xl` = 0.75rem).
2. **Selectores combinables**: `[data-estilo='natura'][data-theme='light'] { … }`. Cada combinación estilo × apariencia × paleta se audita para WCAG AA antes de publicarla.
3. **Arranque sin destello**: el script en línea de `index.html` se amplía para aplicar los cuatro atributos antes de pintar (hoy aplica solo `data-theme`).
4. **Variantes estructurales (sobre todo REBEL)**: la lógica, los datos, los formularios y las validaciones son **los mismos**. Solo cambian las piezas de presentación (`Encabezado`, `Tarjeta`, `Cifra`, transición de página) a través de un `useEstilo()` y un mapa `estilo → componente`. Lo que se resuelva con tokens no lleva una variante.
5. **Sin recursos ajenos**: REBEL toma el *lenguaje* angular y expresivo (diagonales, recortes, contraste alto, tipografía condensada) y nunca personajes, logos, tipografías ni recursos de Edgerunners o Persona.
6. **Orden de construcción**: tokens de forma con los defaults actuales → migrar `ui.tsx` a esos tokens (sin cambio visual) → Natura → IMPACT (reportes y Wrapped) → REBEL.

Carácter de cada estilo (del Design Lab y del anexo del propietario):

- **Original**: el actual. Elegante, oscuro con tinte verde, radios de 16 px.
- **Natura**: elegante y orgánico; radios de 22 px, superficies más cálidas y paletas predefinidas.
- **IMPACT**: minimalismo editorial expresivo; radios de 5 px, cifras enormes, jerarquía tipográfica fuerte. Pensado para reportes, celebraciones y Wrapped.
- **REBEL**: experiencia artística alternativa; radio 0, ángulos y variantes estructurales. **No** es solo color ni radio.

---

## 7. Movimiento (Motion)

| Id | Decisión | Estado |
|---|---|---|
| D-M1 | Motion para React (`motion@14.7.1`, MIT) es la librería de animación JS. Las animaciones CSS que funcionan se quedan; no hay migración masiva | ✅ |
| D-M2 | **Carga diferida**: Motion se importa solo desde `web/src/animacion/` y, mientras haya un único uso, con `import()` dinámico a través de `animacion/motionAnimar.ts` (re-exporta solo `animate`, unos 24 kB gzip). Cuando existan componentes `motion.*` en pantallas comunes se pasa a import estático y se mide de nuevo | ✅ |
| D-M3 | `<MotionConfig reducedMotion="user">` en `main.tsx` **cuando entre el primer componente `motion.*`**. Hoy no se monta porque no protegería nada (el contador comprueba `prefers-reduced-motion` por su cuenta) | ✅ |
| D-M4 | Presets por estilo en `animacion/presets.ts`: duraciones y springs por `data-estilo` × `data-movimiento` (Original y Natura con springs sin rebote, IMPACT con entradas más largas, REBEL con cortes duros y `steps()`). Solo `transform` y `opacity` | 🟡 |
| D-M5 | Transición de salida de página: `AnimatePresence mode="wait"` + `Outlet` congelado (`useOutlet` guardado en una ref) y salida de 120 a 150 ms. No se hace hasta tener D-M4 | 🟡 |
| D-M6 | Modal con spring y salida (`AnimatePresence`), como pide `CLAUDE.md` | 🟡 |
| D-M7 | Lenis **no** se instala por ahora | ✅ |
| D-M8 | React Bits: solo componentes concretos y revisados (licencia, dependencias, rendimiento, accesibilidad, adaptación a tokens). Ninguno se incorporó en esta sesión | ✅ |

---

## 8. Hicotea Wrapped mensual (solo contrato)

Funcionalidad confirmada. Se construye **después** de Reportes (§5).

### 8.1 Contrato de datos (`ResumenMes`, el mismo que usa Reportes)

```ts
type ResumenMes = {
  mes: 'YYYY-MM'
  estado: 'completo' | 'en_curso' | 'sin_datos'   // en_curso = el mes actual
  dias_con_registro: number
  totales: { ingresos: Monto; gastos: Monto; resultado: Monto }       // D-R2
  ahorro: { aportes: Monto; retiros: Monto; rendimientos: Monto; neto: Monto }
  fuentes: { id: number; nombre: string; bruto: Monto; costos: Monto; utilidad: Monto; dias_trabajados: number; activa: boolean }[]
  categorias: { id: number; nombre: string; tipo: TipoCategoria; total: Monto }[]  // agrupadas por id (H-07)
  presupuestos: { id_categoria: number; presupuestado: Monto; gastado: Monto; excedido: boolean }[]  // D-P1
  metas: { id: number; nombre: string; porcentaje_inicio: number; porcentaje_fin: number; cumplida_en_mes: boolean }[]
  comparacion: { mes_anterior: 'YYYY-MM'; resultado_anterior: Monto | null } // null si no hay datos
  destacados: { mejor_dia_producido?: { fecha: string; monto: Monto }; categoria_mayor?: { nombre: string; total: Monto } }
  huella: string   // D-R3
}
```

Los montos son strings con dos decimales, como en el resto de la API. Wrapped **no calcula nada**: solo presenta un `ResumenMes`.

### 8.2 Arquitectura de historias

- Una historia es una función pura `(resumen) => Historia | null`. Devuelve `null` si no aplica (por ejemplo, "Meta cumplida" sin metas), y así nunca se muestra una tarjeta vacía.
- Orden fijo: portada → resultado del mes → de dónde entró → en qué se fue → ahorro → metas → presupuestos → destacado → cierre. Entre 5 y 9 historias según los datos.
- Cada historia declara su contenido (cifras y textos) por separado de su presentación, así cada estilo tiene su propio *renderer* con los mismos datos.

### 8.3 Navegación

- Toque a derecha o izquierda, flechas del teclado, deslizar en móvil y `Esc` para salir. Barra de progreso segmentada.
- **Sin avance automático por defecto** (es dinero, se lee con calma). El avance automático es opcional y se apaga con movimiento reducido.
- Ruta `/wrapped/:mes`, y cada historia con `?h=n` para poder volver atrás.

### 8.4 Estilos y paletas

IMPACT es el estilo de referencia de Wrapped. Los demás estilos reutilizan las mismas historias con su propio *renderer*. Las paletas solo cambian los tokens; el gasto conserva la textura rayada (regla de daltonismo).

### 8.5 Meses incompletos o sin datos

- `en_curso`: se permite verlo, con la etiqueta "Hasta hoy" y sin "cierre".
- `sin_datos` (cero movimientos): una sola tarjeta amable ("Este mes la hicotea descansó") y ninguna historia vacía.
- Pocos datos (< 3 días con registro): se muestran solo las historias con contenido y no se hacen comparaciones.
- Mes anterior sin datos: sin comparación (nunca "∞ %" ni "+100 %").
- Si la `huella` cambió desde que se vio el Wrapped: aviso de que hay datos actualizados.

### 8.6 Accesibilidad y movimiento reducido

- Cada historia es una región con `aria-live="polite"` y un título; las cifras se leen completas ("85 mil pesos").
- Toda gráfica tiene equivalente textual. El color nunca es la única señal.
- Con `prefers-reduced-motion` o `data-movimiento="reducido"`: cambio de historia por fundido corto, sin contadores rodando ni partículas, y sin avance automático.
- Botón de pausa visible si hay avance automático. Objetivos táctiles de al menos 44 px.

---

## 9. Compartir

| Id | Decisión | Estado |
|---|---|---|
| D-S1 | Compartir sale del **menú** de forma reversible con `FUNCIONES.compartir` (`web/src/lib/funciones.ts`), que se activa con `VITE_COMPARTIR=1`. **No se tocan** la API, las tablas (`acceso_compartido`) ni los permisos. Las rutas `/compartir` y `/compartido/:titular` siguen respondiendo, así que quien ya tenía acceso no lo pierde | ✅ |
| D-S2 | Cómo llega un invitado a `/compartido/:titular` sin el menú. Hoy solo desde la pantalla Compartir (por enlace directo). Si se retira del todo, añadir un acceso en el menú de cuenta cuando `compartir.recibidos()` no esté vacío | ⬜ |
