# Decisiones: Financial Integrity, Caparazón y Calendario vivo (2026-11-12)

Continúa [`decisiones-foundations.md`](decisiones-foundations.md). Estados: ✅ aprobado e implementado · 🟢 aprobado, pendiente de implementar · 🟡 propuesto · ⬜ abierto.

---

## 1. Financial Integrity (aprobada por el propietario)

| Id | Decisión | Estado | Implementación |
|---|---|---|---|
| D-F1 | Ninguna operación vuelve a crear saldo en una cajita desactivada: no se puede eliminar su retiro, ni su aporte o rendimiento, ni el gasto que se pagó desde ella, ni cambiar el monto de ese gasto. Corregir datos que no mueven dinero (descripción, categoría, fecha) sí se permite | ✅ | `servicios/movimientos.eliminar` y `actualizar` |
| D-F1b | Segunda protección: el total cuenta el saldo de **todas** las cajitas. Si una inactiva tiene saldo (dato histórico), se incluye y se avisa (`cajitas_inactivas_con_saldo` en `/saldo` y `/tablero`, más una tarjeta en el tablero). No se corrige ningún registro | ✅ | `servicios/tablero._dinero_en_cajitas`, `VistaTablero.AvisosIntegridad` |
| D-F2 | Las correcciones históricas (eliminar o rebajar un ingreso, eliminar un retiro sin enlazar) que dejan el disponible negativo **se permiten con confirmación explícita**: sin `confirmar_negativo=true`, la API responde `409` con `codigo: DISPONIBLE_NEGATIVO` y `datos` (disponible actual, resultante y faltante). Sin movimientos compensatorios. Aportes y repartos siguen exigiendo fondos. **Los gastos ordinarios no cambian de regla** (un gasto nuevo puede dejar el disponible negativo, como antes) | ✅ | `movimientos._validar_correccion`, `web/src/lib/correcciones.ts`, aviso en el tablero con lo asignado en cajitas y lo que falta |
| D-F3 | Serialización por usuario con `SELECT … FROM usuario WHERE id = :u FOR NO KEY UPDATE`, que se toma **antes** de leer saldos. Se eligió en vez de `pg_advisory_xact_lock` (razones en `servicios/serializacion.py`): no hay espacio de claves que repartir, no choca con los `FOR KEY SHARE` de las FK y es reentrante en la transacción. Hay un solo bloqueo por transacción y siempre del mismo usuario, así que no puede haber interbloqueos | ✅ | Movimientos (crear, producido, editar, eliminar), operaciones de cajita, reparto, crear, editar y activar cajitas, confirmar y omitir recurrentes, atajos (vía `registrar`) y metas |
| D-F4 | El desglose por fuente incluye las fuentes inactivas que tuvieron movimientos en el periodo (`activa` en `ResumenFuente`). Gastos por categoría se agrupan por `id` (con `id_categoria` y `tipo`); la web aclara "(costo)" o "(personal)" si el nombre se repite | ✅ | `repos/movimiento.py` |

Riesgo que queda de D-F3: un **doble clic en "Confirmar" de un recurrente** registra dos periodos seguidos. Ya no es una carrera, pero cada confirmación avanza un periodo. La web ya no permite el doble envío (F-02). Endurecimiento propuesto (⬜): que la confirmación envíe la `proxima_fecha` esperada y la API rechace la petición si ya cambió.

---

## 2. Caparazón (aprobado como experiencia unificada del ahorro)

Integra cajitas, metas, reparto, la distribución del dinero protegido y el historial de ahorro.

| Id | Regla | Estado | Implementación |
|---|---|---|---|
| D-C1 | Caparazón es la vista del dinero protegido. No necesita tablas nuevas para cajitas ni reparto | ✅ (concepto) | — |
| D-C2 | Una cajita puede existir sin meta y tener **como máximo una meta activa** | ✅ | Índice `uq_meta_activa_por_cajita` (migración 0007) y validación con mensaje en `servicios/metas.py` (crear, cambiar de cajita, reactivar) |
| D-C3 | Las metas cumplidas conservan su logro: al **archivar** una meta cumplida se guardan `cumplida_en` y `monto_logrado` (el menor entre saldo y objetivo). Una meta archivada con logro se muestra cumplida aunque la cajita se vacíe después | ✅ | Migración 0007 y `metas.cambiar_estado` |
| D-C4 | Las cajitas archivadas siguen accesibles (`/cajitas/:id`); sus movimientos y relaciones no se tocan | ✅ (ya era así) | — |
| D-C5 | Una meta **activa** que alcanza su objetivo no guarda el logro hasta que se archiva o se celebra | ✅ resuelto en la sesión 3: botón explícito "Celebrar y guardar logro" (`POST /metas/{id}/logro`), ver `decisiones-design-system.md §4` | Alternativa: guardarlo la primera vez que se detecte cumplida en una lectura. Se descartó porque escribe durante un GET. Recomendado: un botón "Marcar como lograda" que archive y guarde |
| D-C6 | Reactivar una meta archivada con logro conserva `cumplida_en` (el historial), pero mientras está activa su progreso vuelve a salir del saldo real | ✅ | — |

### Migración 0007 (aditiva y reversible)

- **Antes de crear el índice** busca cajitas con varias metas activas. Si las hay, **aborta sin cambiar nada** y lista usuario, cajita y metas: el propietario decide cuál archivar. No elimina, archiva ni reasigna nada.
- Base de desarrollo inspeccionada en modo solo lectura el 2026-11-12: 1 meta, **0 conflictos**, 0 cajitas inactivas con saldo.
- Verificado en una base temporal: aborta con un conflicto, la versión sigue en 0006 y las metas quedan intactas. Después de resolverlo a mano, `upgrade → downgrade → upgrade` funciona.
- `downgrade` borra el índice y las columnas de logro (respáldalas antes si ya tienen datos).

### Experiencia visual (diseño; sin implementar)

**Tres métricas distintas, nunca en la misma superficie sin etiqueta:**

| Métrica | Qué es | Dónde se ve |
|---|---|---|
| **Porcentaje de reparto** | regla configurada para repartir ingresos (`cajita.porcentaje`) | anillo exterior o etiqueta "Reparto 25 %"; la cajita resto muestra "Resto" |
| **Proporción ahorrada** | saldo de la cajita / total en cajitas | **área de la placa**: es la única superficie proporcional |
| **Progreso de meta** | saldo / objetivo de su meta activa | barra o arco dentro del panel de detalle, nunca el área de la placa |

- **Tortuga en SVG**: el caparazón es un conjunto de placas (hexágonos). El área de cada placa es proporcional al saldo de su cajita mediante un *treemap* hexagonal o un *voronoi* ponderado. Si el cálculo exacto resulta caro, se usan placas **iguales** y la proporción se muestra como número, sin aparentar proporcionalidad (regla del propietario).
- Las placas de las cajitas sin saldo son grises y con contorno discontinuo. Las archivadas van fuera del caparazón, en "Guardadas".
- Colores: tokens `--serie-1…6` (por definir y validar para daltonismo). Cada placa lleva **número o inicial y patrón**, no solo color.
- Al elegir una placa (clic, Enter o flechas) se abre el panel: nombre, saldo real, % de reparto, meta y avance, y acciones de **Aporte**, **Retiro** y **Detalle**.
- **Lista accesible equivalente** (siempre visible en móvil y alternable en escritorio) con la misma información: el SVG lleva `role="img"` con resumen y la interacción real vive en la lista. Con movimiento reducido no hay animación de placas.

---

## 3. Calendario vivo (confirmado por el propietario)

Evoluciona el calendario existente (`GET /api/calendario`, `VistaCalendario`, `servicios/tablero.calendario`); no se creó uno paralelo.

| Id | Alcance | Estado |
|---|---|---|
| C-01 | Estados por día que pueden coexistir: hoy, ingresos, gastos, operaciones de ahorro (aparte), pasados sin registros (suaves, ○), compromisos previstos (◷, recurrentes activos con `proxima_fecha` ese día), futuros (sin marcas de olvido). Los días sin registros solo se marcan desde el primer movimiento del usuario y nunca hoy ni en el futuro. Zona `America/Bogota` | ✅ |
| C-02 | Selección de cualquier día (clic o teclado). Navegación por mes, salto a mes y año (`<input type=month>`) y "Hoy". Detalle con ingresos, gastos, ahorro separado ("no es ingreso ni gasto"), compromisos y movimientos del día (`GET /movimientos?desde=&hasta=`) | ✅ |
| C-03 | Registro retrospectivo con **los mismos formularios y endpoints**: `/movimientos/nuevo?tipo=&fecha=&volver=`, `/producido?fecha=&volver=` y atajos con `POST /atajos/{id}/usar {"fecha"}` (cuerpo opcional nuevo). Aviso visible de la fecha antes de confirmar, y confirmación modal al usar un atajo en un día que no es hoy. La API guarda la fecha efectiva y sigue rechazando las futuras, junto con RN-01 y las validaciones de categoría, fuente y saldo | ✅ |
| C-03b | Operaciones de ahorro con fecha precargada desde el calendario | ✅ (sesión 3) |
| C-04 | Días confirmados sin actividad | ✅ (sesión 3, migración 0009) |
| C-05 | Recordatorio en el tablero ("El día de ayer no tiene movimientos registrados") | ✅ (sesión 3) |
| C-06 | Una consulta agregada por intervalo (`totales_por_dia`, que ahora incluye ahorro y conteo de registros) más una de compromisos y una de inicio del historial: **3 consultas por mes, sin N+1**. Los datos son solo del usuario autenticado y los montos van como strings decimales. Caché: el calendario y el detalle se recargan con `useSaldo().version`, que sube tras crear, editar, eliminar o deshacer | ✅ |
| C-07 | Tokens existentes, marcadores con forma propia (no solo color), leyenda, `role="grid"` con `aria-label` completo por día y `aria-current="date"`, foco móvil por flechas, Inicio/Fin y RePág/AvPág, estados vacíos, dos columnas desde `lg` y una en móvil. Entrada del detalle con la animación CSS existente (respeta reduced-motion). **No se usó Motion**: no hacía falta para registrar rápido | ✅ |

### C-04 · Diseño de "día sin actividad" (aprobado e implementado tal cual en la migración 0009)

```sql
-- Migración 0009 (implementada)
CREATE TABLE dia_sin_actividad (
    id_usuario     BIGINT      NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    fecha          DATE        NOT NULL,
    confirmado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_usuario, fecha)
);
```

- **No es un movimiento**: no toca `movimiento` ni los saldos. Se deshace con `DELETE /api/dias-sin-actividad/{fecha}`.
- Crear: `PUT /api/dias-sin-actividad/{fecha}` (idempotente). Se rechaza si la fecha es futura, es anterior al inicio del historial o ya tiene registros.
- Si después se registra un movimiento real esa fecha, **el movimiento manda**: el calendario calcula `confirmado_sin_actividad = existe fila AND registros = 0`. No hace falta borrar la fila (así no se pierde el dato si el movimiento se elimina después).
- Multidispositivo: está en la BD, no en `localStorage`.
- El calendario lo lee con un `LEFT JOIN` por intervalo, dentro de la misma consulta mensual.
- `downgrade`: `DROP TABLE` (es una preferencia de presentación y no hay riesgo financiero).

### C-05 · Recordatorio (diseño)

Una tarjeta discreta en Inicio, solo si **ayer** cumple `sin_registros` y no está confirmado como sin actividad. Acciones: registrar con fecha de ayer, usar un atajo (mismo `AtajosDelDia`), "No hubo actividad" (C-04) y "Descartar" (el descarte **sí** puede vivir en `localStorage`, por dispositivo, porque no es un dato financiero). El tono es informativo: "El día de ayer no tiene movimientos registrados." Sin notificaciones externas.

### Resumen mensual (para Reportes y Wrapped)

El `ResumenMes` de `decisiones-foundations.md §8.1` se alimenta de la misma consulta por intervalo del calendario más `resumen` y `resumen_por_fuente` (ya corregidos por D-F4). Un movimiento retrospectivo cae en su mes porque todo se agrupa por `movimiento.fecha`.

---

## 4. Sistema de diseño (sin cambios en esta sesión)

Se mantiene el plan de `decisiones-foundations.md §6`: cuatro ejes (estilo, apariencia, paleta, movimiento), Natura como primera variante completa y REBEL con variantes estructurales sin duplicar lógica. Añadidos para evaluar:

- **Apariencia automática** (🟡): un tercer valor `sistema` en `hicotea:tema` que siga a `prefers-color-scheme` y escuche sus cambios. El script en línea de `index.html` lo resuelve antes de pintar. Ahora que `dark:` sigue a `data-theme` (F-04), es seguro.
- Las paletas **pueden** redefinir `--fondo` y `--superficie*` si el estilo lo pide, con auditoría WCAG AA por combinación. `--gasto` y `--aviso` solo cambian con una nueva validación de daltonismo.
- **Tokens de estado del calendario** (🟡): `--dia-sin-registros`, `--dia-compromiso`, `--dia-ahorro`. Hoy se usan `superficie-2`, `aviso` y `acento`.

---

## 5. Fases posteriores (confirmadas, en backlog)

- **Presupuestos**: historial por periodo, modalidad de seguimiento y modalidad financiada con una cajita vinculada. Los gastos reales cuentan como consumo, sin duplicar reservas ni gastos, y lo que queda en la cajita no desaparece al terminar el mes.
- **Compromisos**: evolución de Recurrentes con confirmación manual, cuotas y obligaciones, quincena colombiana opcional, disponible proyectado y sin descontar dos veces lo ya financiado.
- **Reportes y Wrapped**: un servicio compartido con historial fiable, resultado mensual, utilidad operativa, movimiento de ahorro, saldo inicial y final, metas alcanzadas, gastos presupuestados y no presupuestados, Wrapped recalculable a partir de datos reales, e IMPACT como referencia artística.
