# Correo transaccional y plantillas (fase 3A)

Estado: implementado el 2026-11-14, sin commit. Sin cambios de base de datos (sigue en **0011**).
No se ha enviado ningún correo real: SMTP solo se probó con un servidor simulado.

## 1. Qué cambió

| Pieza | Antes | Ahora |
|---|---|---|
| `Correo` | `para`, `asunto`, `texto` | + `html` opcional (compatible: quien no lo pasa sigue igual) |
| MIME | `text/plain` | Con HTML: `multipart/alternative` (texto primero, HTML después), UTF-8, `Date`, `Message-ID` del dominio remitente, `Auto-Submitted: auto-generated` |
| `disponible()` | True con `CORREO_MODO=smtp`, aunque faltara el host | True solo si el transporte **puede** enviar: con SMTP incompleto o inseguro es False, el perfil dice que el correo no está configurado y el PIN sigue en el log |
| Arranque | — | Si SMTP está incompleto, el log explica qué falta (nombres de variables, nunca valores) |
| Contraseña SMTP | `str` | `SecretStr`: no aparece en `repr`, volcados ni errores |
| Timeout | 15 s fijo | `HICOTEA_SMTP_TIMEOUT` (1–60, por defecto 15) |
| Errores | Tipo de excepción en el log | Tipo + explicación (`describir_error`) sin la respuesta del servidor, el destinatario ni el contenido |
| Plantillas | Texto en cada servicio | `app/plantillas_correo.py`: texto + HTML con la identidad Original |
| CLI | — | `correo estado`, `correo probar <dirección>`, `correo vista-previa <carpeta>` |

### Validación de la configuración SMTP (`correo.problemas_smtp`)
Bloquean el envío (`disponible()` = False):
- falta `HICOTEA_SMTP_HOST`;
- usuario sin contraseña o contraseña sin usuario;
- credenciales con `HICOTEA_SMTP_SEGURIDAD=ninguna` (la contraseña viajaría sin cifrar);
- `HICOTEA_CORREO_REMITENTE` que no es una dirección, o usa `localhost` o un dominio de ejemplo (`example.com`…);
- `HICOTEA_URL_PUBLICA` que no es una URL absoluta http(s).

Solo avisan (`correo.avisos_smtp`): puerto 465/2465 con `starttls`, 25/587/2587 con `ssl`, URL pública
en `localhost` o en `http`.

Un relay local sin credenciales ni cifrado (`ninguna`, puerto 25) sigue permitido.

## 2. Plantillas

| Plantilla | Uso | Estado |
|---|---|---|
| `verificacion` | Enlace para confirmar un correo (registro y perfil) | **Integrada** |
| `recuperacion_pin` | PIN de "Olvidé mi contraseña" | **Integrada** |
| `aviso_contrasena_cambiada` | Tras restablecer con PIN o cambiar desde el perfil | **Integrada** (reemplaza el texto que ya se enviaba) |
| `aviso_correo_cambiado` | A la dirección verificada anterior, cuando se verifica otra | **Integrada** (reemplaza el texto que ya se enviaba) |
| `invitacion` | Invitación de registro | **Preparada, sin integrar** |
| `prueba` | `python -m app.cli correo probar` | Solo CLI |

No se añadió **ninguna notificación nueva**: los tres avisos de seguridad ya existían en texto plano.
La invitación no se integra porque hoy el panel muestra el enlace **una sola vez** para compartirlo por un
canal privado. Enviarlo por correo es otro flujo: un botón "Enviar por correo" en `/admin`, el destinatario
obligatorio, la auditoría del envío y la decisión de qué pasa si falla. Queda lista para cuando se decida.

### Diseño
- Identidad **Original**, tema claro del kit, con variante oscura para los clientes que respetan
  `prefers-color-scheme` (Apple Mail, iOS y algunos Android). Gmail y Outlook invierten los colores a su
  manera; el diseño claro aguanta la inversión porque el texto esencial va sobre fondos planos.
- Colores reales de `tokens.css`: fondo `#F4FBF7`, tarjeta `#FFFFFF`, borde `#C5DFD3`, texto `#071912` y
  `#3E6052`, botón `#047857` con texto blanco (5,5:1), franja superior `#34D399` y punto del wordmark
  `#3F6212` (en oscuro `#A3E635`). Avisos de seguridad con borde `#D97706`, que solo se usa como color de
  borde: nunca como texto, porque no alcanza contraste AA.
- Logo: el oficial es SVG, que Gmail y Outlook no muestran, y la identidad se está revisando con un
  diseñador externo. Por eso se usa el **wordmark textual** "Hicotea." (Plus Jakarta Sans 800, con las
  fuentes del sistema como respaldo). No se inventó un logo. Cuando exista uno definitivo en PNG, basta
  con cambiar el encabezado de `_marco`.
- Maquetación con tablas, estilos inline, 560 px de contenido que se vuelven fluidos por debajo, comentarios
  condicionales para Outlook de escritorio y un botón hecho con una celda con fondo y un enlace. Debajo va
  el enlace completo en texto, porque Outlook a veces no pinta el botón.
- Sin JavaScript, imágenes, fuentes remotas, píxeles ni enlaces de seguimiento. Todo enlace va a
  `HICOTEA_URL_PUBLICA`, y las pruebas lo comprueban.
- El PIN no va en el asunto ni en la vista previa de la bandeja (se verían en la pantalla bloqueada).

### Seguridad de las plantillas
- Todo dato dinámico pasa por `html.escape` (también dentro de `href`). En el texto plano se quitan los
  caracteres de control, para que un nombre no pueda "fabricar" líneas.
- `url_segura` solo admite URLs http(s) absolutas: un `javascript:` o una ruta relativa lanza `ValueError`.
- Las vigencias las pasa cada servicio desde sus constantes reales: `HORAS_VIGENCIA = 24` de la
  verificación, y `MINUTOS_VIGENCIA = 15` y `MAXIMO_INTENTOS = 5` del PIN. La invitación usa su `expira_en`
  real, en hora de Colombia.
- Sin datos financieros (lo comprueba una prueba).

## 3. Variables de configuración

| Variable | Por defecto | Notas |
|---|---|---|
| `HICOTEA_CORREO_MODO` | `ninguno` | `ninguno` \| `consola` (solo desarrollo) \| `smtp` |
| `HICOTEA_CORREO_REMITENTE` | `Hicotea <no-responder@localhost>` | Con `smtp` debe ser de un dominio verificado en el proveedor |
| `HICOTEA_SMTP_HOST` | — | Obligatoria con `smtp` |
| `HICOTEA_SMTP_PUERTO` | `587` | 1–65535 |
| `HICOTEA_SMTP_SEGURIDAD` | `starttls` | `starttls` \| `ssl` \| `ninguna` (esta última, solo sin credenciales) |
| `HICOTEA_SMTP_USUARIO` | — | Va junto con la contraseña |
| `HICOTEA_SMTP_CONTRASENA` | — | **Secreto**: solo en `.env.prod` (chmod 600), nunca en el repo |
| `HICOTEA_SMTP_TIMEOUT` | `15` | Segundos (1–60) para conectar y para cada respuesta |
| `HICOTEA_URL_PUBLICA` | `http://localhost:5173` | Base de los enlaces. Producción: `https://hicotea.duckdns.org` (ya en `docker-compose.prod.yml`) |

## 4. Probar localmente (sin enviar nada real)

```sh
cd api
uv run pytest -q tests/unidad/test_correo.py tests/integracion/test_correo_flujos.py

# Configuración actual, sin secretos (sale con 1 si el correo no está disponible)
uv run python -m app.cli correo estado

# Vistas previas con datos ficticios (.html, .txt y .eml); abre los .html en el navegador
uv run python -m app.cli correo vista-previa /tmp/hicotea-correos

# Flujo completo en modo consola: con HICOTEA_CORREO_MODO=consola en api/.env, agrega un correo en
# /perfil y copia del log de la API el enlace de verificación.
```

Los `.eml` se pueden abrir en Thunderbird o Apple Mail para ver el MIME tal como saldría.

## 5. Configurar Resend (SMTP)

Hicotea no depende de Resend: cualquier proveedor SMTP sirve con las mismas variables.

1. Crea la cuenta en Resend y **verifica un dominio propio**: Resend da registros DNS (SPF, DKIM y,
   opcionalmente, DMARC) que se agregan en el proveedor del dominio. **Sin un dominio verificado no se puede
   enviar a cualquier destinatario.** La dirección de pruebas de Resend solo sirve para enviarse correos a
   la dirección de la propia cuenta, no para uso general. Ojo: `duckdns.org` no es un dominio tuyo y no
   permite agregar esos registros, así que el remitente necesita un dominio propio.
2. Crea una API key con permiso solo de envío ("Sending access"), limitada al dominio si se puede.
3. En el servidor, en `.env.prod` (chmod 600, fuera de Git):
   ```
   HICOTEA_CORREO_MODO=smtp
   HICOTEA_CORREO_REMITENTE=Hicotea <no-responder@TU-DOMINIO-VERIFICADO>
   HICOTEA_SMTP_HOST=smtp.resend.com
   HICOTEA_SMTP_PUERTO=465
   HICOTEA_SMTP_SEGURIDAD=ssl
   HICOTEA_SMTP_USUARIO=resend
   HICOTEA_SMTP_CONTRASENA=<la API key; no la pegues en chats ni en el repo>
   ```
   Alternativa: puerto `587` (o `2587`) con `HICOTEA_SMTP_SEGURIDAD=starttls`. Resend también admite
   `25` y `2465`.
4. Reinicia la API y revisa:
   ```sh
   docker compose -f docker-compose.prod.yml exec api python -m app.cli correo estado
   ```
5. Envía la prueba **a una dirección tuya**. El comando pide confirmación y no incluye datos de cuentas:
   ```sh
   docker compose -f docker-compose.prod.yml exec -it api python -m app.cli correo probar tu@direccion
   ```
   Si falla, la salida dice por qué (credenciales, remitente no verificado, TLS, timeout…) sin mostrar la
   respuesta del servidor ni la clave.
6. Revisa que llegue a la bandeja de entrada y no a spam. En Gmail, "Mostrar original" debe decir
   `SPF: PASS` y `DKIM: PASS`.

## 6. Pruebas

- `tests/unidad/test_correo.py` (49): MIME (solo texto, alternative, orden, UTF-8, cabeceras, sin
  inyección), las 6 plantillas (texto + HTML, sin recursos externos, enlaces solo a la URL pública), escape
  en texto y `href`, URLs peligrosas, vigencias reales, PIN fuera del asunto y del preencabezado, fecha en
  hora de Colombia, sin datos financieros, configuración completa e incompleta (10 casos), relay local,
  avisos, `SecretStr`, log de arranque sin secretos, SSL implícito con verificación de certificado,
  STARTTLS antes del login, sin login cuando no hay credenciales, fallo registrado sin secretos ni contenido,
  10 errores explicados, límites de timeout y puerto, consola, memoria y CLI (estado, probar, rechazo de
  direcciones, confirmación y vista previa).
- `tests/integracion/test_correo_flujos.py` (5): verificación con HTML y texto con el mismo enlace de un
  solo uso, PIN y aviso en HTML, escape de la dirección nueva en el aviso, y que SMTP incompleto (leído
  de verdad, sin reemplazar el transporte) deshabilite la verificación y que SMTP completo la habilite.

## 7. Limitaciones pendientes
- **Ningún envío real probado**: falta configurar Resend, o el proveedor que se elija, con un dominio propio.
- El envío sigue siendo **síncrono** (hasta `HICOTEA_SMTP_TIMEOUT` por petición).
- Compatibilidad visual comprobada en Chromium (360 y 640 px, claro y oscuro), **no** en Gmail, Outlook ni
  clientes móviles reales. Conviene revisar los correos de prueba en esos clientes.
- Sin logo gráfico (a propósito, hasta que llegue la identidad definitiva).
- La invitación por correo está preparada, pero no tiene flujo.
- Con `HICOTEA_CORREO_MODO=ninguno`, o si el envío falla, el PIN sigue escribiéndose en el log para quien
  administra. Es el comportamiento acordado en 0010 para cuentas sin correo. Con SMTP funcionando y
  correos verificados, deja de pasar.
- `consola` escribe enlaces y PIN en el log: solo es para desarrollo. Si se activa con
  `HICOTEA_COOKIE_SECURE=true`, el arranque lo advierte.
