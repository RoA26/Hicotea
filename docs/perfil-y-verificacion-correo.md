# Recurrentes, perfil y verificación de correo

Estado: implementado el 2026-11-14 (migración **0011**), sin commit. Pendiente de validación del propietario.

## 1. Integridad de recurrentes (`RECURRENTE_AVANZO`)

### Causa
`POST /recurrentes/{id}/confirmar` y `/omitir` no decían **qué ocurrencia** se confirmaba: el servicio
siempre actuaba sobre la `proxima_fecha` vigente. El candado por usuario (`serializar_finanzas`) evitaba
que dos confirmaciones avanzaran en paralelo, pero no que la segunda se aplicara: al entrar leía la
fecha ya avanzada y confirmaba **la ocurrencia siguiente**, creando un movimiento duplicado y saltando
otro periodo aunque no estuviera pendiente. Pasaba con doble toque, reintento de red, dos pestañas, un
modal abierto antes de "Omitir" o después de editar la fecha.

### Corrección
- El cuerpo de ambas rutas lleva `ocurrencia` (obligatoria): la `proxima_fecha` que vio el usuario.
- Tras el candado, si `ocurrencia ≠ proxima_fecha` → **409** `codigo = "RECURRENTE_AVANZO"`,
  `datos.proxima_fecha`, mensaje con la fecha nueva. No se registra ni avanza nada.
- Defensa en profundidad: el avance es un `UPDATE … WHERE proxima_fecha = :ocurrencia`
  (`repos/otros.recurrente_avanzar_si`). Si no actualiza una fila, la transacción completa (movimiento
  incluido) se revierte.
- Sin cambios en las reglas financieras: la fecha del movimiento, el monto y las validaciones de
  fondos siguen igual. Confirmar antes de tiempo sigue permitido (con fecha de hoy), como antes.
- Web: `ConfirmarRecurrente`, Inicio y Recurrentes envían la ocurrencia; ante 409 muestran el mensaje,
  cierran el modal y recargan la lista (`lib/correcciones.esRecurrenteAvanzado`).
- Compatibilidad: un cliente viejo sin `ocurrencia` recibe 422 ("Revisa los datos"). La PWA se
  actualiza sola (`registerType: autoUpdate`).

Pruebas: `tests/integracion/test_recurrentes.py` (9), incluida una carrera real con dos conexiones.

## 2. Perfil (`/perfil`, API `/api/cuenta`)

Entrada "Perfil y apariencia" en el menú lateral y en "Más" (reemplaza el modal "Estilo y apariencia").
Cuatro secciones con filas (etiqueta, valor, acción), sin tarjetas anidadas; cada acción sensible abre
un formulario corto en un modal.

| Sección | Qué hay | API |
|---|---|---|
| Tu cuenta | Nombre (editable), usuario (no editable: es el login), fecha de registro | `GET/PATCH /api/cuenta` |
| Correo | Estado (verificado, sin verificar, sin correo), dirección pendiente con reenviar/corregir y cancelar | `POST /api/cuenta/correo`, `DELETE /api/cuenta/correo/pendiente` |
| Seguridad | Cambiar contraseña; sesiones abiertas y "Cerrar las demás" | `POST /api/cuenta/contrasena`, `POST /api/cuenta/sesiones/cerrar-otras` |
| Apariencia | `AjustesApariencia` (estilo con muestra de color, paleta, claro/oscuro/sistema, movimiento) | — (localStorage) |

- Solo se edita `nombre_completo`: el modelo no tiene más datos personales y no se añadieron.
- Cambiar la contraseña exige la actual, aplica las reglas de `validar_contrasena`, no acepta la misma,
  cierra **las demás** sesiones (no la actual), anula los PIN pendientes y avisa al correo verificado.
- Sesiones: se reutiliza la tabla `sesion`; no hay lista por dispositivo (no se guarda agente ni IP).
- Apariencia: misma infraestructura (`tema/preferencias.ts`), sin cambios de persistencia: por
  dispositivo, en `localStorage`. IMPACT y REBEL siguen visibles como "Próximamente" y deshabilitados;
  su muestra es una franja neutra (no se inventan colores).

## 3. Verificación de correo

### Modelo (migración 0011, aditiva)
- `usuario.correo_verificado_en`: NULL = sin verificar. Ningún correo existente queda verificado.
- `verificacion_correo`: `id_usuario`, `correo`, `token_hash` (SHA-256), `creada_en`, `expira_en`,
  `usada_en`, `anulada_en`.

### Flujo
1. En el perfil, el usuario escribe la dirección y **su contraseña actual** (reautenticación).
2. La API crea un token de 256 bits (`secrets.token_urlsafe(32)`), guarda solo su SHA-256, anula los
   enlaces anteriores y envía `URL_PUBLICA/verificar-correo?token=…` (vigencia 24 h, un solo uso).
3. La dirección queda **pendiente**: no reemplaza a la actual y no recibe el PIN.
4. `/verificar-correo` funciona con o sin sesión (el enlace puede abrirse en otro dispositivo), quita
   el token de la URL y llama `POST /api/cuenta/correo/verificar` **una sola vez**.
5. Al verificar: `usuario.correo = nueva`, `correo_verificado_en = now()`, se anulan otros enlaces y los
   PIN pendientes, y se avisa a la dirección verificada anterior ("tu correo cambió").

### Reglas de seguridad
| Riesgo | Control |
|---|---|
| Robo de sesión abierta | Correo y contraseña piden la contraseña actual; 5 fallos por cuenta e IP (20 por IP) en 15 min → 429 |
| Token filtrado en la base | Solo SHA-256; el enlace en claro solo va en el correo |
| Reuso / carreras | `UPDATE … WHERE usada_en IS NULL AND anulada_en IS NULL AND expira_en > now() RETURNING` |
| Fuerza bruta de tokens | 256 bits + 10 enlaces inválidos por IP en 15 min → 429 |
| Abuso de envíos | Un enlace por minuto por cuenta (429); un enlace nuevo anula los anteriores |
| Enumeración de correos | Si la dirección ya está **verificada** en otra cuenta, la respuesta es idéntica y no se envía nada |
| Correo ajeno escrito sin verificar | Quien verifica la dirección se la queda: se quita de la otra cuenta (que no podía usarla) |
| Cuenta bloqueada | Su enlace no verifica |
| Correo sin verificar usado para recuperar | **No**: el PIN solo va a un correo verificado y solo un correo verificado identifica la cuenta en "Olvidé mi contraseña" |

### Efecto en la recuperación de contraseña
- Con correo verificado y transporte: PIN por correo (sin log), como antes.
- Sin correo, con correo sin verificar o sin transporte: PIN en el log para quien administra (como antes de 0010).
- Los avisos de "tu contraseña cambió" van solo al correo verificado.
- Las cuentas existentes **no se bloquean ni se les exige nada**: siguen igual hasta que agreguen un correo.

### Registro
Si la cuenta nace con correo (incluido el de una invitación), queda sin verificar y se envía el enlace
automáticamente si hay transporte. Si no hay o falla el envío, la cuenta se crea igual.

### Sin transporte de correo
`HICOTEA_CORREO_MODO=ninguno` (por defecto en producción): el perfil lo indica y no deja agregar ni
verificar (503 `CORREO_NO_CONFIGURADO`). No se escribe el enlace en el log: verificar consiste en
demostrar acceso al buzón, y un enlace entregado por quien administra no lo demostraría.

**Configuración externa pendiente para producción**: credenciales SMTP reales (`HICOTEA_CORREO_MODO=smtp`
y `HICOTEA_SMTP_*`, ver `administracion-y-recuperacion.md §5`). `HICOTEA_URL_PUBLICA` ya está en
`docker-compose.prod.yml`. Recomendado: SPF/DKIM del dominio remitente para que los enlaces no caigan en spam.

## 4. Refinamientos de UX (2026-11-14)

| Problema | Antes | Después |
|---|---|---|
| Teclado virtual | La barra inferior fija seguía visible: en iOS flota sobre el teclado y en Android ocupa el poco alto que queda | En pantallas táctiles se oculta (`translate-y-full` + `inert`) mientras un campo de texto tiene el foco y vuelve al salir (`Marco.tsx → useTecladoAbierto`). También revisa al montar (autoFocus) y al volver a la ventana |
| Perfil y apariencia | Modal "Estilo y apariencia" sin contexto de cuenta | Página `/perfil` con apariencia integrada y muestra de color por estilo |
| Correo pendiente largo | (primera versión) los botones partían la dirección | Acciones debajo del texto |
| Recurrente obsoleto | Duplicaba el movimiento en silencio | Aviso claro, cierre del modal y recarga |

Comprobado con Chromium en emulación móvil (no en dispositivos físicos): 10 rutas × 4 anchos
(320, 360, 768, 1280) sin desborde horizontal, sin errores de JavaScript, contraste del botón secundario
del perfil entre 10,8:1 y 16:1 en Original y Natura, claro y oscuro.

## 5. Limitaciones conocidas
- La detección del teclado usa el foco, no `visualViewport`: con un teclado físico en una tableta táctil la barra también se oculta mientras se escribe.
- No hay "quitar correo" (no se pidió); se puede cambiar por otro.
- No hay lista de sesiones por dispositivo.
- Preferencias visuales por dispositivo, no por cuenta.
- Envío SMTP síncrono (hasta 15 s) también en el registro con correo.
- Los limitadores siguen en memoria (una instancia).
