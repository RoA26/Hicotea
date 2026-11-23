# Administración, invitaciones y recuperación de cuenta

Estado: implementado el 2026-11-14 (migración **0010**). Pendiente de validación del propietario.

## 1. Modelo de autorización

- `usuario.rol` ∈ `USUARIO` | `ADMIN` (CHECK `ck_usuario_rol`). Dos niveles, sin jerarquía extra.
- El rol se lee **de la base en cada petición**, en la misma consulta que valida la sesión
  (`repos/sesion.usuario_por_token`). Quitar o dar el rol aplica en la siguiente petición.
- `seguridad/dependencias.admin_actual` → `AdminActual`: toda ruta `/api/admin/*` lo exige.
  Sin sesión: **401**. Con sesión y sin rol: **403**. Ocultar el menú en la web es solo comodidad.
- La migración no da el rol a nadie. **Nadie es administrador por defecto.**

## 2. Primer administrador (aprovisionamiento)

Se hace con un comando en el servidor: quien puede ejecutarlo ya controla la máquina y la base,
así que no abre una vía nueva. No hay credenciales por defecto en el código.

```sh
# Desarrollo
cd api
uv run alembic upgrade head                       # aplica 0010
uv run python -m app.cli admin otorgar <usuario>  # la cuenta debe existir y estar habilitada
uv run python -m app.cli admin listar

# Si todavía no existe ninguna cuenta: crear una invitación desde la consola
uv run python -m app.cli invitacion crear --dias 1 --nota "Mi cuenta"
# → imprime el enlace UNA vez; regístrate con él y luego "admin otorgar".

# Producción (dentro del contenedor de la API; no requiere reconstruir nada)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api python -m app.cli admin otorgar <usuario>
```

- `admin revocar <usuario>` se niega si es el único administrador activo.
- Cada cambio queda en `auditoria_admin` con autor `cli:<usuario del sistema>`.
- Antes de otorgar el rol en producción, confirma que la cuenta es tuya (inicia sesión con ella).

## 3. Invitaciones

| Regla | Implementación |
|---|---|
| Token seguro | `secrets.token_urlsafe(32)` (256 bits). |
| Sin secreto en claro | Solo se guarda `SHA-256(token)` (`invitacion.token_hash`). Con 256 bits de entropía no hace falta argon2. |
| Enlace visible una vez | Solo la respuesta de `POST /api/admin/invitaciones` (o el CLI) trae `enlace`. El listado no lo trae y no se puede recuperar. |
| Expiración | 1–30 días (por defecto `HICOTEA_INVITACION_DIAS` = 7). |
| Estados | `PENDIENTE`, `USADA`, `EXPIRADA`, `REVOCADA`, derivados de las fechas (no se pueden contradecir). |
| Un solo uso y carreras | `UPDATE … SET usada_en = now() WHERE token_hash = :t AND usada_en IS NULL AND revocada_en IS NULL AND expira_en > now() RETURNING …` dentro de la transacción del registro. Si llegan dos registros a la vez, el segundo espera el bloqueo de fila y, al reevaluar, no actualiza nada (prueba `test_dos_registros_simultaneos_con_la_misma_invitacion_solo_uno_gana`). Si el registro falla después (usuario repetido), el rollback la deja pendiente. |
| Revocación | Solo de pendientes; queda `revocada_por`. |
| Registro de creación y uso | `creada_por`, `creada_en`, `usada_por`, `usada_en` + auditoría. |
| Asociada a correo (opcional) | Si se indica, el registro exige ese correo y la cuenta queda con él. |
| Enumeración | La invitación se valida **antes** de comprobar si el usuario o el correo existen: sin invitación válida no se puede averiguar qué cuentas hay. Los intentos con invitación inválida cuentan en `limitador_registro` (10 por IP en 15 min). |

### Cambio en el registro y compatibilidad

- `HICOTEA_CODIGO_INVITACION` pasa de **obligatorio** a **opcional (modo heredado)**. Mientras tenga
  valor, ese código sigue sirviendo junto con las invitaciones individuales: **nada cambia para
  producción hasta que lo vacíes**. Recomendado: cuando exista un administrador, deja la variable
  vacía en `.env.prod` y reinicia la API. Desde ese momento solo se entra con invitación del panel.
- Las cuentas existentes no se tocan: siguen con su usuario y contraseña, rol `USUARIO`, sin correo.
- La pantalla de registro acepta `/registro?invitacion=<token>`: comprueba el enlace antes de pedir
  datos, oculta el campo de código y precarga el correo si la invitación lo trae.

## 4. Panel de administración (`/admin`)

Marco propio (no el de las finanzas) y fragmento JS aparte que solo descargan los administradores.

| Sección | Qué hace | API |
|---|---|---|
| Resumen | Cuentas (total, habilitadas, bloqueadas, administradores), invitaciones por estado y actividad reciente | `GET /api/admin/resumen` |
| Usuarios | Lista paginada (20), búsqueda por usuario, nombre o correo (comodines escapados), filtro por estado; fecha de registro, último ingreso y sesiones abiertas; bloquear, desbloquear y cerrar sesiones con confirmación | `GET /api/admin/usuarios`, `POST …/{id}/bloquear`, `…/desbloquear`, `…/cerrar-sesiones` |
| Invitaciones | Crear (vigencia, nota, correo opcional), copiar el enlace (una vez), filtrar por estado y revocar pendientes | `GET/POST /api/admin/invitaciones`, `POST …/{id}/revocar` |
| Auditoría | Quién, qué, sobre qué, cuándo y con qué resultado | `GET /api/admin/auditoria` |

**Bloqueo**: `activo = FALSE` (la columna que ya usaba la sesión) + `bloqueado_en`. Al bloquear se
**borran todas sus sesiones** y se anulan sus PIN pendientes. Una cuenta bloqueada no puede iniciar
sesión ni recuperar la contraseña. Al intentar entrar con la contraseña **correcta** ve "Tu cuenta
está bloqueada"; con una incorrecta, el error genérico (no se revela el estado a quien no la conoce).
Sus datos financieros quedan intactos.

**Salvaguardas**: un administrador no puede bloquearse a sí mismo ni cerrar sus propias sesiones
desde el panel. Nunca se puede bloquear al último administrador activo. Las acciones que cambian
cuentas se serializan con `pg_advisory_xact_lock`, así que dos administradores que se bloquean a la
vez no pueden dejar la plataforma sin ninguno. Los intentos rechazados también quedan auditados (se
guardan con commit antes de responder 409).

**Auditoría** (`auditoria_admin`): `id_admin`, `admin_nombre` (copia por si la cuenta se borra),
`accion`, `recurso_tipo`, `recurso_id`, `recurso_nombre`, `resultado` (`EXITO` | `RECHAZADO`),
`detalle` y `fecha`. Nunca guarda contraseñas, tokens, PIN ni montos.

### Privacidad (lo que el panel **no** hace)

No consulta ingresos, gastos, saldos ni movimientos de nadie; no modifica ni borra datos
financieros; no muestra ni fija contraseñas; no permite suplantar. `repos/admin.py` no toca ninguna
tabla financiera, y `test_listado_busqueda_y_filtros_sin_datos_financieros` comprueba que las
respuestas del panel no contienen montos, "saldo", "token" ni "pin".

## 5. Recuperación de contraseña

Se conserva el flujo de PIN de 6 dígitos (ya cumplía hash argon2, 15 minutos, 5 intentos, un solo
uso y cierre de sesiones) y se completa:

- **Entrega por correo** (desde 0011, solo a un correo **verificado**): si la cuenta tiene correo verificado y hay transporte, el PIN va por correo y **no**
  se escribe en el log. Sin correo, o si el envío falla, queda en el log como antes, para que quien
  administra lo entregue tras verificar la identidad por un canal acordado.
- **Usuario o correo verificado** en "Olvidé mi contraseña" (un correo sin verificar no identifica la cuenta).
- **Sin enumeración**: la misma respuesta exista o no la cuenta y tenga o no correo. Restablecer
  contra una cuenta inexistente cuesta lo mismo (argon2 de relleno) y da el mismo error que un PIN
  vencido. La validación de la contraseña nueva usa lo que escribió la persona, no la cuenta encontrada.
- **Límites por IP**: solicitudes de PIN, 5 por cuenta e IP y 15 por IP cada 15 minutos
  (`limitador_recuperacion`). PIN incorrectos, 10 por cuenta e IP y 30 por IP (`limitador_pin`),
  además de los 5 intentos por PIN en la base.
- **Validación de la contraseña nueva** (también al registrarse): 8–128 caracteres, sin espacios al
  principio ni al final, no una de las más comunes, al menos 3 caracteres distintos y sin el nombre de usuario.
- Al cambiarla: se anulan todos los PIN pendientes, se cierran **todas** las sesiones y, si hay
  correo, se envía un aviso de "tu contraseña cambió".
- El administrador **no** puede ver ni fijar contraseñas ni generar PIN desde el panel.

### Correo: configuración

`app/correo.py` define un transporte intercambiable (`HICOTEA_CORREO_MODO`):

| Modo | Uso |
|---|---|
| `ninguno` (por defecto) | No envía. El PIN queda en el log (comportamiento previo). |
| `consola` | Escribe el correo completo en el log. **Solo desarrollo.** |
| `smtp` | Envío real con `smtplib`. Si la configuración está incompleta, equivale a `ninguno` (fase 3A). |

Variables para `smtp` (no hay valores inventados; consíguelas de tu proveedor):

```
HICOTEA_CORREO_MODO=smtp
HICOTEA_CORREO_REMITENTE=Hicotea <no-responder@tu-dominio>
HICOTEA_SMTP_HOST=smtp.tu-proveedor.com
HICOTEA_SMTP_PUERTO=587            # 465 con SMTP_SEGURIDAD=ssl
HICOTEA_SMTP_USUARIO=...
HICOTEA_SMTP_CONTRASENA=...        # secreto: solo en .env.prod (chmod 600)
HICOTEA_SMTP_SEGURIDAD=starttls    # starttls | ssl | ninguna
HICOTEA_SMTP_TIMEOUT=15            # segundos
```

Plantillas HTML, validación de la configuración, `app.cli correo estado|probar|vista-previa` y los pasos
para Resend: **`docs/correo-transaccional.md`**.

Un fallo del servidor de correo no rompe la solicitud: se registra el tipo de error (sin el contenido)
y el PIN queda en el log para quien administra. Las pruebas usan `correo.BuzonMemoria`.

Los usuarios existentes no tienen correo. Desde 0011 lo agregan, cambian y verifican en `/perfil`
(ver `docs/perfil-y-verificacion-correo.md`).

## 6. Variables nuevas

| Variable | Por defecto | Para qué |
|---|---|---|
| `HICOTEA_CODIGO_INVITACION` | vacío (antes obligatorio) | Código global heredado. |
| `HICOTEA_URL_PUBLICA` | `http://localhost:5173` | Base de los enlaces de invitación. En producción: `https://hicotea.duckdns.org` (ya en `docker-compose.prod.yml`). |
| `HICOTEA_INVITACION_DIAS` | `7` | Vigencia por defecto (1–30). |
| `HICOTEA_CORREO_MODO`, `HICOTEA_CORREO_REMITENTE`, `HICOTEA_SMTP_*` | `ninguno` | Ver §5. |

## 7. Riesgos y pendientes

- Los limitadores viven en memoria (un worker): se reinician al reiniciar la API. Es suficiente para una sola instancia.
- Si el envío por SMTP tarda, la petición de recuperación espera hasta `HICOTEA_SMTP_TIMEOUT` (15 s; envío síncrono).
- Resuelto en 0011: el correo del registro queda sin verificar hasta abrir el enlace, y solo uno verificado recibe el PIN.
- No hay gestión de roles desde el panel (a propósito): dar o quitar el rol solo se hace por CLI.
- No hay "sesiones por dispositivo"; cerrar sesiones las cierra todas.
