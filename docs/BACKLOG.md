# Backlog de Evolución de Hicotea

Documento maestro de seguimiento, planificación y registro de decisiones para la evolución funcional y visual de Hicotea (Eden 2).

---

## 📌 Estado General del Proyecto

| Fase | Descripción | Estado | Responsable | Notas |
|---|---|---|---|---|
| **Fase 0** | Identidad visual, tokens y kit de marca | ✅ Completado | Gem de Gemini | Tokens en `tokens.css`, assets en `Identidad/` |
| **Fase 1** | Esqueleto del monorepo, Docker y Auth | ✅ Completado | Claude Code | Monorepo FastAPI + Vite React |
| **Fase 2** | Backend completo portado desde Eden | ✅ Completado | Claude Code | SQLAlchemy Core, migraciones Alembic, repos y servicios |
| **Fase 3** | Pantallas base funcionales | ✅ Completado | Claude Code | Rutas y componentes base |
| **Fase 4** | Microinteracciones y animaciones | ✅ Completado | Antigravity (`fa9466a`) | Canvas de partículas, contador animado, transiciones |
| **Fase A** | Evolución de Botones rápidos a Atajos | 🚀 **Implementado (Pendiente commit)** | Antigravity | Pestañas Atajos/Categorías, creación contextual, redirect |
| **Fase B** | Cajitas de ahorro y lógica de reparto | 🚀 **Implementado (Pendiente commit)** | Antigravity | Presets 5%, visualizador caparazón, rediseño detalle |
| **Fase C** | Dashboard / Tablero (layout bento y métricas) | 📋 Planificado | Por definir | Análisis completado |
| **Fase D** | Landing page y flujos de autenticación | 📋 Planificado | Por definir | Análisis completado |
| **Fase E** | Benchmarking exhaustivo con Eden | 📋 Planificado | Por definir | Comparativa inicial documentada |
| **Foundations** | Auditoría financiera, decisiones, fundamentos de diseño, Motion | 🚀 **Implementado (Pendiente revisión y commit)** | Claude Code | `docs/auditoria-foundations.md`, `docs/decisiones-foundations.md` |
| **Integridad** | D-F1…D-F4: cajitas inactivas, disponible negativo, concurrencia, reportes históricos | 🚀 **Implementado (Pendiente revisión y commit)** | Claude Code | `docs/decisiones-caparazon-calendario.md §1` |
| **Caparazón** | Unificación (navegación, tortuga, detalle, cajita + meta, logros, historial, archivo) | 🚀 **Implementado (Pendiente revisión visual y commit)** | Claude Code | `docs/decisiones-design-system.md §4` |
| **Design System + Natura** | Cuatro ejes, tokens de forma, tipo, movimiento y series, Natura (8 combinaciones AA) | 🚀 **Implementado (Pendiente revisión visual)** | Claude Code | `§1–3` |
| **Calendario vivo** | C-01…C-07 completos, distribución 70/30 | 🚀 **Implementado (Pendiente revisión visual)** | Claude Code | `§5–6` |

---

## 🐢 Caparazón, Design System y Natura (2026-11-12, sesión 3)

### Hecho (sin commit)
- [x] **Caparazón** como entrada única: `/caparazon` (tortuga de 7 placas iguales, grupo "+N", lista accesible, proporción real aparte, panel con las tres métricas, Repartir, Nueva cajita, historial y archivo). `/cajitas` y `/metas` redirigen; se conservan `/cajitas/:id` y `/cajitas/reparto`. Se retiraron las páginas `Cajitas.tsx` y `Metas.tsx` (su funcionalidad está en el Caparazón y en el detalle).
- [x] Detalle de cajita: descripción, tres métricas, meta (añadir, editar, pausar, reactivar), metas históricas, **Celebrar y guardar logro**, "Archivar" y "Reactivar", y `?operacion=` y `?fecha=` precargados.
- [x] Crear cajita y meta en una sola transacción (`POST /cajitas` con `meta`). Migración **0008**: `cajita.descripcion` y `meta.alcanzada_en`.
- [x] Sistema de diseño: `tema/preferencias.ts` (estilo, apariencia con "sistema", paleta, movimiento) sin destellos y compatible con `hicotea:tema`. Tokens nuevos y migración de radios a tokens sin cambio en Original.
- [x] **Natura** completa en 4 paletas × claro y oscuro, todas AA. Selector en "Estilo y apariencia".
- [x] Calendario: ancho 7xl, 70/30 con panel plegable, celdas más ricas en pantallas anchas y cabecera nueva.
- [x] **C-04** días sin actividad (migración **0009**), **C-05** recordatorio en Inicio y **C-03b** ahorro retrospectivo.
- [x] Pruebas: `test_caparazon.py` (6) y `test_dias_sin_actividad.py` (5). **Total: 117 en verde.**

### Pendiente
- [ ] **Revisión visual del propietario** (no se probó en el navegador): Caparazón en claro y oscuro, Natura en las 8 combinaciones, calendario en escritorio y móvil.
- [ ] Decidir `--aviso` en Original claro (3,19:1, heredado del kit).
- [ ] IMPACT y REBEL (estructura lista; faltan hojas, paletas y auditoría).
- [ ] Recurrentes: rechazar una confirmación si `proxima_fecha` ya avanzó.
- [ ] Presupuestos, Compromisos y Reportes/Wrapped (ver `decisiones-caparazon-calendario.md §5`).

### Punto de continuación
**Antes de probar: `cd api && uv run alembic upgrade head`** (0007 → 0009). Sin eso, `/api/cajitas` falla porque falta `cajita.descripcion`. Siguiente paso: revisión visual, ajustes, y después IMPACT (pensado para Reportes y Wrapped).

---

## 🛡️ Integridad, Caparazón y Calendario vivo (2026-11-12, sesión 2)

### Hecho (sin commit)
- [x] **D-F1**: no se puede recrear saldo en cajitas desactivadas, y el total cuenta (y avisa) cualquier saldo histórico en ellas.
- [x] **D-F2**: las correcciones que dejan el disponible negativo piden confirmación (409 `DISPONIBLE_NEGATIVO`). El tablero explica lo asignado y lo que falta. Aportes y repartos siguen exigiendo fondos.
- [x] **D-F3**: serialización por usuario (`servicios/serializacion.py`). H-04 se reprodujo antes (6 de 7 pruebas fallaban) y pasa después.
- [x] **D-F4**: fuentes inactivas en el desglose histórico y categorías agrupadas por id.
- [x] **Caparazón**: una meta activa por cajita y logro histórico al archivar (migración **0007**, aditiva, aborta si encuentra conflictos).
- [x] **Calendario vivo**: estados C-01, selección y detalle C-02, registro retrospectivo C-03 (formulario, producido y atajos con fecha), consulta agregada C-06 y accesibilidad C-07.
- [x] Pruebas nuevas: `test_concurrencia.py` (7), `test_integridad.py` (13), `test_calendario.py` (8) y 4 de metas en `test_ahorro.py`. **Total: 106 en verde.**

### Pendiente
- [ ] **C-04** días sin actividad: tabla `dia_sin_actividad` diseñada (§3), **esperando aprobación** antes de crear la migración 0008.
- [ ] **C-05** recordatorio en el tablero (depende de C-04).
- [ ] **C-03b**: operaciones de ahorro con fecha precargada desde el calendario.
- [ ] **Caparazón visual**: tortuga SVG + lista accesible (diseño en §2), tokens `--serie-*`.
- [ ] **D-C5**: botón "Marcar como lograda" para metas activas cumplidas.
- [ ] Recurrentes: rechazar una confirmación si `proxima_fecha` ya avanzó (doble confirmación).
- [ ] Sistema de diseño: tokens de forma, apariencia automática, Natura (sin empezar).
- [ ] Presupuestos (historial, modalidad financiada), Compromisos y Reportes/Wrapped: ver §5.

### Punto de continuación
Backend con 106 pruebas en verde; web con build, typecheck y lint sin errores nuevos. **Antes de probar en local: `cd api && uv run alembic upgrade head`** (0006 → 0007). Si no, `/api/metas` y `/api/tablero` fallan porque falta la columna `meta.cumplida_en`. Siguiente paso recomendado: aprobar o ajustar C-04 → migración 0008 → C-05.

---

## 🧱 Foundations (2026-11-12)

### Hecho en esta sesión (sin commit; lo revisa el propietario)
- [x] Auditoría financiera completa del backend y de los cálculos de la web: 74 pruebas en verde y una sonda temporal que reprodujo H-01, H-02 y H-03 (ver `auditoria-foundations.md`).
- [x] **F-01** corregido: una cajita de 0,5 % se mostraba y se precargaba al editar como 50 % (`lib/formato.ts → porcentajeNumero`).
- [x] **F-02** corregido: `Boton` no se desactivaba mientras `cargando` (doble envío en todos los formularios) (`componentes/ui.tsx`).
- [x] **F-04** corregido: `dark:` seguía al sistema operativo y no al tema elegido (`@custom-variant dark` en `tema/tokens.css`).
- [x] Compartir fuera del menú de forma reversible (`lib/funciones.ts`, `VITE_COMPARTIR=1`); API, datos, permisos y rutas intactos.
- [x] Repartir mejorado **sin tocar las reglas**: porcentaje o "Resto" en cada línea, "Sugerido" cuando se edita, "Volver a lo sugerido", resumen "Asignado / Queda en el disponible", validación en vivo con las reglas de lectura de la API (`parsearMonto`, **F-03**) y confirmación desactivada si no hay nada asignado, el monto es inválido o se excede el disponible.
- [x] Motion `14.7.1` instalado con pnpm. Primera integración en `ContadorAnimado` (sin renders por frame, interrumpible, carga diferida: el paquete inicial pasa de 112,2 a 112,9 kB gzip y Motion va en un fragmento aparte de unos 24 kB).
- [x] `CLAUDE.md` refleja el estado real de la animación (Lenis no instalado).

### Pendiente — necesita decisión del propietario (`decisiones-foundations.md`)
- [ ] **D-F1** (Alta): impedir eliminar movimientos de cajitas desactivadas (H-01, dinero que desaparece del total).
- [ ] **D-F2**: disponible negativo, ¿aviso o bloqueo?
- [ ] **D-F3**: `pg_advisory_xact_lock` en las operaciones de dinero.
- [ ] **D-C1/D-C2**: definir el Caparazón y la regla de una meta activa por cajita.
- [ ] **D-P1**: historial de montos de presupuesto (requisito para Reportes).
- [ ] **D-K1/D-K2**: Compromisos (cambio de nombre de Recurrentes) y quincena colombiana.
- [ ] **D-R2/D-R3/D-R4**: contrato de Reportes (`ResumenMes`).

### Siguiente (orden recomendado)
1. Aplicar D-F1 y D-F3 con pruebas de integración (backend, cambios pequeños).
2. Tokens de forma (`--radio-*`, `--sombra-*`, `--fuente-cifra`) con los defaults actuales y migrar `ui.tsx` **sin cambio visual**. Ampliar el script en línea de `index.html` a los cuatro ejes (§6 de decisiones).
3. Tokens de serie `--serie-*` para el Caparazón (D-C3).
4. Primera variante **Natura** (no se empezó: los fundamentos del punto 2 aún no existen y hacerlo ahora exigiría una refactorización extensa).
5. `MotionConfig` + presets por estilo (D-M3, D-M4); después, modal con spring (D-M6) y salida de página (D-M5).
6. Reportes (`GET /api/reportes/mes`) → Wrapped mensual (§8 de decisiones).

### Punto de continuación (Foundations, histórico)
La web compila (`pnpm build`), el lint no tiene errores nuevos y el backend no se modificó. Revisión visual pendiente del propietario: **Repartir**, **Cajitas** (porcentajes y colores del caparazón en claro y oscuro con el SO en el modo contrario), **menú sin Compartir** y **contador del saldo** al registrar un movimiento.

---

## 🐢 Fase A — Módulo de Atajos y Gestión de Categorías

### Objetivos Alcanzados
- [x] **Renombrado en barra lateral**: De "Botones rápidos" a "Atajos" con ícono conservado.
- [x] **Consolidación de navegación**: Retiro de la ruta independiente `/categorias` del menú principal.
- [x] **Redirección transparente**: `/categorias` redirige con `<Navigate to="/atajos" replace />`, garantizando que marcadores o historial previo sigan funcionando.
- [x] **Pantalla con doble pestaña accesible**:
  - Pestaña **Mis atajos**: Tarjetas con tipo (Ingreso/Gasto), categoría, monto formateado en pesos colombianos, acción "Usar" con protección anti-doble clic y acción de eliminar con diálogo de confirmación destructiva.
  - Pestaña **Categorías**: Agrupación en 3 columnas/secciones (`Ingreso`, `Gasto personal`, `Costo operativo`), acciones para renombrar (modal), activar/desactivar y crear nueva categoría.
- [x] **Modal contextual para nuevos atajos**: Evita el consumo permanente de espacio horizontal en pantallas grandes. Muestra estado vacío con ejemplos cuando no hay atajos registrados.
- [x] **Creación contextual de categorías**: Si el usuario está creando un atajo y necesita una categoría que aún no existe, puede pulsar "+ Nueva categoría" directamente dentro del formulario sin perder los datos ya digitados (nombre, monto, tipo).
- [x] **Prevención de pulsaciones accidentales**: Estado `usando` con indicador de carga y botón inhabilitado durante el registro.
- [x] **Integridad de datos**: Cero modificaciones de backend o base de datos. Las categorías siguen siendo entidades universales compartidas por movimientos, presupuestos y reportes.

---

## 📦 Fase B — Cajitas y Reparto Financiero

### Objetivos Alcanzados
- [x] **Porcentajes humanos y formateo unificado**: Creación de `formatoPorcentaje` y `porcentajeNumero` en `lib/formato.ts` para mostrar `5%`, `12,5%` (nunca decimales crudos como `0.05` ni `5.00%`).
- [x] **Selector de porcentajes con incrementos de 5%**:
  - Stepper con botones `[- 5%]` y `[+ 5%]` y valor destacado.
  - Botonera de presets comunes: `5%`, `10%`, `15%`, `20%`, `25%`, `30%`, `40%`, `50%`.
  - Modo alternable para porcentaje personalizado exacto con validación dinámica en tiempo real.
- [x] **Visualizador del Caparazón de Ahorro**:
  - Barra segmentada horizontal multicromática que muestra visualmente la cuota de cada cajita activa, el porcentaje absorbido por la cajita "Resto" y el porcentaje sin asignar.
- [x] **Rediseño completo de la vista de detalle (`CajitaDetalle.tsx`)**:
  - Saldo acumulado en grande con `ContadorAnimado`.
  - Métricas estadísticas calculadas del historial (total aportado, total retirado, ganancias/rendimientos).
  - Selector de operaciones segmentado (`Segmentos`: Aporte, Retiro, Rendimiento) con textos explicativos de cada tipo.
  - Lista de movimientos pulida con acciones de eliminación destructiva con confirmación.
- [x] **Mejoras en el flujo de reparto (`Reparto.tsx`)**:
  - Suma en vivo de los montos asignados frente al disponible con alerta inmediata si se sobrepasa lo disponible.
  - Alerta formativa si la suma de porcentajes no llega al 100% y no hay cajita resto.

---

## 📊 Fase C — Dashboard / Tablero (Propuesta y Backlog)

### Diagnóstico de la Implementación Actual
- Componente `VistaTablero.tsx` renderiza tarjetas lineales apiladas: Saldo total, alertas de presupuestos, métricas del mes actual, gráficas SVG personalizadas (`Graficas.tsx`), cajitas, metas y últimos movimientos.

### Tareas Planificadas
1. **Layout tipo Bento Grid**:
   - Reorganizar el tablero en una cuadrícula asimétrica moderna (responsive: 1 columna en móvil, 2 columnas en tablet, 3-4 celdas bento en desktop).
   - Posicionar en el foco principal: Saldo disponible vs. Saldo en cajitas (con el degradado esmeralda→lima ya presente).
2. **Integración de la Mascota (Hicotea)**:
   - Añadir la ilustración de la hicotea con estados emocionales en vacíos:
     - Sin movimientos del mes: Hicotea descansando ("Todo en calma").
     - Metas cumplidas: Hicotea con moneda brillante ("¡Meta lograda!").
     - Presupuesto en alerta o excedido: Hicotea asomando la cabeza cautelosa.
3. **Optimización de Gráficas**:
   - Mantener el patrón rayado accesible para daltonismo (WCAG AA).
   - Añadir tooltip interactivo táctil para consultar valores en móviles sin tener que pulsar enlaces externos.

---

## 🔐 Fase D — Landing, Login y Registro (Propuesta y Backlog)

### Diagnóstico de la Implementación Actual
- `Landing.tsx` cuenta con el fondo interactivo de partículas verdes (`ParticulasLanding.tsx`), titular tipográfico y tres tarjetas de características.
- Los formularios de autenticación (`Login.tsx`, `Registro.tsx`, `Recuperar.tsx`, `Restablecer.tsx`) utilizan el contenedor centrado `MarcoAuth.tsx`.

### Tareas Planificadas
1. **Enriquecimiento de la Landing Page**:
   - Sección de "Filosofía Hicotea": Explicación de la metáfora de la tortuga (ahorrar lento pero seguro, protección del capital).
   - Vista previa interactiva simulada (mockup o captura interactiva) del tablero y las cajitas.
   - FAQ interactiva (acordeón accesible) respondiendo dudas sobre privacidad, uso offline y exportación de datos.
2. **Refuerzo de Flujos de Autenticación**:
   - Visibilidad de contraseña (botón "ojo" para mostrar/ocultar).
   - Indicador visual de fortaleza de contraseña en `Registro.tsx`.
   - Mensaje claro sobre el código de invitación (`HICOTEA_CODIGO_INVITACION`) para evitar frustración en usuarios nuevos.
   - Manejo más guiado en `Recuperar.tsx` (explicar que el PIN de 6 dígitos se genera localmente en servidor).

---

## ⚖️ Fase E — Benchmarking con Eden

### Matriz Comparativa Inicial

| Dimensión | Eden (Legacy) | Hicotea (Actual / Objetivo) | Ventaja / Decisión |
|---|---|---|---|
| **Arquitectura** | Monolito Spring Boot 3 + Thymeleaf + Alpine.js | FastAPI (API REST) + Vite React (PWA) | Hicotea desacopla frontend/backend, permitiendo modo offline y mejor reactividad. |
| **Acceso a Datos** | `JdbcClient` de Spring (Java) | SQLAlchemy 2 Core (Python) | Ambos usan SQL explícito de alto rendimiento sin sobrecarga de ORM pesados. |
| **Experiencia Móvil** | Renderizado en servidor (SSR), recarga parcial con Alpine | SPA instalable (PWA) con Service Worker y precaching | Hicotea ofrece sensación de aplicación nativa instantánea. |
| **Interacción Atajos** | Botones rápidos estáticos con recarga de fragmentos | Atajos con ejecución inmediata, optimista y botón "Deshacer" | Mayor agilidad de registro diario (1 toque en la calle). |
| **Gestión de Sesión** | Cookie de sesión JSESSIONID + CSRF token | Cookie HttpOnly `SameSite=Lax` con hash Argon2 | Seguridad equivalente con menor fricción de sincronización en llamadas AJAX. |

---

## 🛠️ Convención de Commits para este Proyecto

Seguir la especificación [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(modulo): descripción breve en imperativo

- detalle de lo realizado 1
- detalle de lo realizado 2
```

Ejemplos:
- `feat(web): evolucionar botones rapidos a modulo de atajos con gestion de categorias`
- `refactor(cajitas): incorporar presets del 5% y barra de distribucion`
- `docs(backlog): registrar plan de evolucion para fases B a E`

