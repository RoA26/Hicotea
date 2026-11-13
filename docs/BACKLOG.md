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

