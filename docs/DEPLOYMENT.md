# Primer despliegue de Hicotea

Estado: infraestructura preparada para revisión; no se ha conectado a Dante ni desplegado.
Todos los cambios permanecen sin commit. El workflow solo puede publicar el contenido
que el propietario posteriormente revise e incorpore a Git; un SHA actual no incluye
los cambios locales de producto ni las migraciones 0007–0009 sin seguimiento.

## Diseño y requisitos

Caddy del host termina HTTPS → `127.0.0.1:8091` → Nginx sin root en 8080 →
FastAPI en 8000 → PostgreSQL 17. Todas las rutas API conservan `/api`.
Proyecto `hicotea-prod`, red `hicotea-prod_internal`, volumen
`hicotea-prod_pgdata`; no se comparte nada con Bastión ni con el Compose de desarrollo.
Solo web publica un puerto, exclusivamente loopback. No usar `network_mode: host`.
API y web se descargan ya construidas; nunca construir imágenes en Dante.

Los límites son 384 MiB para PostgreSQL (64 MiB shared_buffers, 30 conexiones),
256 MiB para API y 64 MiB para web. Son presupuestos iniciales, no mediciones:
observar `docker stats` y OOM con carga real. Argon2 consume memoria por petición;
evitar concurrencia alta de registro/recuperación. Un worker conserva coherencia
con el limitador de login en memoria; sus contadores se pierden al reiniciar.
Logs por servicio: máximo aproximado 15 MiB (3 × 5 MiB). Vigilar también disco,
volumen, backups y caché de imágenes; no ejecutar limpiezas globales de Docker.

Las bases de imágenes siguen tags de versión y reciben cambios aguas arriba.
Cada release debe conservar los digests obtenidos tras la construcción; para
reproducibilidad binaria estricta fijar las bases por digest revisado. Los tags
`sha-<40 caracteres>` identifican el código, pero GHCR permite reescribir tags;
para mayor garantía usar `ghcr.io/...@sha256:...` en `.env.prod`.
Confirmar la arquitectura de Dante (`uname -m`): el workflow construye linux/amd64;
para ARM debe prepararse la imagen en otra máquina/CI para esa plataforma.

## Seguridad y límites conocidos

Settings reales: `HICOTEA_DATABASE_URL`, `HICOTEA_CODIGO_INVITACION` (opcional desde 0010),
`HICOTEA_COOKIE_SECURE`, `HICOTEA_ORIGENES_PERMITIDOS`, `HICOTEA_URL_PUBLICA` y, para el
correo de recuperación, `HICOTEA_CORREO_MODO` y `HICOTEA_SMTP_*`
(ver `docs/administracion-y-recuperacion.md`). Tras desplegar 0010: `alembic upgrade head`
y `python -m app.cli admin otorgar <usuario>` dentro del contenedor de la API. Compose fija las dos últimas
a `true` y `["https://hicotea.duckdns.org"]`; genera la URL interna usando una
contraseña hexadecimal nueva. No copiar `api/.env` ni usar credenciales de desarrollo.
Los secretos se pasan solo en tiempo de ejecución: no están en los builds ni en
Git. Administradores del daemon Docker pueden leerlos; limitar ese acceso.
Cambiar `POSTGRES_PASSWORD` en el archivo NO cambia una base ya inicializada:
requiere rotar el rol en PostgreSQL y la configuración coordinadamente.

Sesiones: cookie host-only, Path=/, HttpOnly, Secure, SameSite=Lax, duración por
defecto 30 días; token aleatorio, solo SHA-256 almacenado en BD. Contraseñas Argon2.
CSRF: SameSite=Lax y rechazo de Origin distinto al autorizado en métodos inseguros;
peticiones sin Origin se permiten. No habilitar CORS amplio ni alojar contenido
no confiable en este mismo origen. No hay token CSRF independiente.
La API confía en headers de proxy porque solo Nginx tiene acceso público indirecto:
no publicar nunca su puerto. Caddy debe sobrescribir `X-Real-IP` según el bloque
inferior; Nginx usa ese valor para que el limitador reciba la IP real y fija HTTPS.
El acceso local directo al puerto 8091 queda reservado a administradores de confianza.
`/api/salud` confirma proceso HTTP, no conectividad BD ni migraciones;
verificar también Alembic y `/api/auth/yo` durante cada despliegue.

Nginx fuerza `Cache-Control: no-store, private` en API y no utiliza proxy cache.
PWA: NetworkOnly para todas las lecturas `/api`, sin fallback SPA para API;
el nuevo worker borra la antigua caché `hicotea-api` al activarse.
El shell estático permanece disponible offline; los datos financieros no.
Clientes con un worker antiguo abierto deben conectarse y actualizarlo antes de
considerar retirada la caché previa; verificar Cache Storage en el navegador.

Registro por invitación: compartir el secreto solo por canal privado; no verifica
correo/identidad. No se cargan datos demo al inicializar; las categorías por usuario
se crean al registrarse como parte del comportamiento existente.
Recuperación actual: PIN de seis cifras en logs de API, hash Argon2 en BD,
vence en 15 minutos, cinco intentos, una solicitud por minuto por cuenta y revoca
sesiones al cambiar contraseña. Operación inicial solo para grupo pequeño y conocido:
verificar identidad por un canal previamente acordado ANTES de entregar el PIN,
consultar `docker compose logs --since 5m api` de forma privada y entregarlo por
ese canal. No copiar logs a tickets, CI, chats colectivos ni servicios externos.
Limitar usuarios con acceso a Docker/logs/backups. Rotación de logs no equivale a
borrado seguro. Pendiente: entrega por canal verificado sin PIN en logs y límites
por IP/globales para registro y recuperación; la invitación por sí sola no evita
consumo abusivo de recursos en esos endpoints. Evaluar estos controles antes de
abrir el registro a una audiencia amplia.

## Publicación de imágenes

`.github/workflows/production-images.yml` ejecuta pytest en PostgreSQL aislado,
typecheck, lint, build y construcción de imágenes. PR construye sin publicar;
push a main y workflow_dispatch publican en GHCR. Nunca conecta al VPS.
Confirmar que `main` sea la rama de publicación deseada. El propietario deberá
revisar e incorporar todos los archivos y migraciones antes de ejecutar el workflow.
Las imágenes tienen el mismo SHA: `ghcr.io/roa26/hicotea-{api,web}:sha-<SHA>`.
En repositorios con paquetes privados dar acceso de lectura al operador de Dante.
Usar PAT con `read:packages` (y autorización SSO si aplica), nunca token de escritura:

```bash
read -r -s -p 'PAT GHCR: ' GHCR_TOKEN; echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u TU_USUARIO_GITHUB --password-stdin
unset GHCR_TOKEN
```

Docker guarda autenticación localmente: proteger `~/.docker/config.json` o usar
credential helper; ejecutar `docker logout ghcr.io` si no se necesita persistencia.

## Preparar archivos (máquina local, sin secretos en la transferencia)

Estos comandos son para el propietario; el agente no los ejecuta:

```bash
scp docker-compose.prod.yml .env.prod.example scripts/backup.sh scripts/restore.sh OPERADOR@201.79.36.173:/opt/hicotea/deploy/
```

En Dante, usar el usuario autorizado para Docker y con escritura en `/opt/hicotea`.
No sobrescribir archivos de secretos existentes:

```bash
cd /opt/hicotea/deploy
umask 077
chmod 700 /opt/hicotea/backups
chmod 700 backup.sh restore.sh
# Solo la primera vez; -n protege un archivo existente.
cp -n .env.prod.example .env.prod
chmod 600 .env.prod
openssl rand -hex 32
openssl rand -hex 32
nano .env.prod
```

Poner cada valor generado en POSTGRES_PASSWORD y HICOTEA_CODIGO_INVITACION,
y los dos tags SHA de la misma ejecución exitosa del workflow en las imágenes.
No introducir secretos como argumentos de shell ni compartir `compose config`
sin `--quiet`, porque puede imprimir credenciales.

## Primer arranque en Dante

```bash
cd /opt/hicotea/deploy
dc() { docker compose --env-file .env.prod -f docker-compose.prod.yml "$@"; }
dc config --quiet
dc pull
dc up -d --wait db
# Inicializa el volumen vacío con POSTGRES_DB/USER/PASSWORD; no hay seeds.
dc run --rm --no-deps api alembic upgrade head
dc run --rm --no-deps api alembic current
# Debe mostrar 0009 (head) en esta versión.
dc up -d --wait api web
dc ps
curl --fail http://127.0.0.1:8091/healthz
curl --fail http://127.0.0.1:8091/api/salud
curl -i http://127.0.0.1:8091/api/auth/yo
# Sin sesión: 401 con Cache-Control: no-store, private.
curl -I http://127.0.0.1:8091/inicio
# SPA: 200 HTML. db/api no deben mostrar HostPort en inspect/compose ps.
```

Migraciones se ejecutan explícitamente antes de arrancar API; nunca al iniciar
cada worker. Si fallan, no continuar. La base inicial es nueva y vacía.
No usar `down -v`, no renombrar proyecto/volumen entre releases.

## Caddy (aplica el propietario)

Conservar el bloque de Bastión exactamente como está y añadir:

```caddy
hicotea.duckdns.org {
    encode gzip
    reverse_proxy 127.0.0.1:8091 {
        header_up X-Real-IP {remote_host}
    }
}
```

Validar y recargar, sin instalar Nginx/Certbot en el host:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl --fail https://hicotea.duckdns.org/api/salud
```

Desde navegador HTTPS verificar registro/login/logout, cookie Secure/HttpOnly/Lax,
403 para Origin ajeno, carga de rutas profundas y fallo offline de API sin datos
cacheados. Revisar también que Bastión siga operativo tras la recarga.

## Respaldos, actualización y restauración

`backup.sh` usa pg_dump custom de PostgreSQL 17, umask 077, carpeta 700 y archivos
600; escribe `.partial`, verifica con `pg_restore -l` antes de renombrar y solo
entonces elimina dumps propios de más de 14 días. Variables opcionales:
DEPLOY_DIR, BACKUP_DIR, RETENTION_DAYS (0 desactiva purga; restore usa 0 para conservar el dump elegido). `pg_restore -l` comprueba catálogo, no
sustituye un ensayo completo de restauración en otra base aislada.

```bash
/opt/hicotea/deploy/backup.sh
# Cron del operador autorizado a Docker, diario a las 03:15 UTC si esa es la TZ del host:
# 15 3 * * * /opt/hicotea/deploy/backup.sh >> /opt/hicotea/backups/backup.log 2>&1
```

Preparar backup.log con chmod 600 y rotarlo; confirmar zona horaria del host.
Descargar periódicamente los dumps a otra máquina/almacenamiento cifrado con
acceso restringido y retención independiente; verificar sumas SHA-256 tras la
copia y ensayar restauración. Copiar solo en el mismo disco del VPS no protege
contra su pérdida. No guardar credenciales en el dump ni compartirlo públicamente:
contiene finanzas personales y hashes de autenticación.

Actualización manual (mismo directorio y función dc del primer arranque):

```bash
cd /opt/hicotea/deploy
dc() { docker compose --env-file .env.prod -f docker-compose.prod.yml "$@"; }
# Registrar los tags/digests anteriores en un lugar privado para poder volver.
# Editar únicamente ambos tags de imagen al nuevo SHA aprobado.
nano .env.prod
dc config --quiet
dc pull
# Descargar primero; detener escritores antes del snapshot y las migraciones.
dc stop web api
./backup.sh
dc run --rm --no-deps api alembic upgrade head
dc run --rm --no-deps api alembic current
dc up -d --wait api web
dc ps
curl --fail http://127.0.0.1:8091/api/salud
```

Si backup/migración falla, mantener API/web detenidas e investigar. Una imagen
anterior solo puede volver directamente si soporta el esquema actual; no hacer
downgrade automático de migraciones financieras. Para volver a un snapshot:

```bash
cd /opt/hicotea/deploy
./restore.sh /opt/hicotea/backups/hicotea-FECHA.dump
# Pide escribir exactamente: RESTAURAR hicotea
# Crea antes otro backup, detiene API/web y restaura en transacción única.
# Si falla, conserva servicios detenidos; no arranca automáticamente.
# Editar .env.prod con las imágenes compatibles con el snapshot.
nano .env.prod
dc pull
dc run --rm --no-deps api alembic current
# Si procede avanzar el esquema, ejecutar explícitamente alembic upgrade head.
dc up -d --wait api web
curl --fail http://127.0.0.1:8091/api/salud
```

La restauración elimina objetos existentes del dump y reemplaza los datos; ejecutar
solo tras confirmar el proyecto y aceptar la pérdida de operaciones posteriores
al snapshot. Sesiones del snapshot pueden reaparecer: valorar invalidarlas en un
procedimiento controlado de incidente. No se ejecutó ninguna restauración real
como parte de esta preparación.

## Alternativa sin acceso a GHCR desde Dante

En máquina de construcción con Docker (nunca en Dante), desde el árbol aprobado:

```bash
# Identificador elegido para ESTA construcción; si hay cambios sin commit,
# no presentarlo como una imagen que corresponde íntegramente a un SHA Git.
RELEASE=manual-20261113-1
docker build -t hicotea-api:$RELEASE api
docker build -t hicotea-web:$RELEASE web
docker save -o hicotea-images.tar hicotea-api:$RELEASE hicotea-web:$RELEASE
sha256sum hicotea-images.tar > hicotea-images.tar.sha256
scp hicotea-images.tar hicotea-images.tar.sha256 OPERADOR@201.79.36.173:/opt/hicotea/deploy/
```

En Dante:

```bash
cd /opt/hicotea/deploy
sha256sum -c hicotea-images.tar.sha256
docker load -i hicotea-images.tar
# .env.prod: HICOTEA_API_IMAGE=hicotea-api:manual-20261113-1
#            HICOTEA_WEB_IMAGE=hicotea-web:manual-20261113-1
# Seguir arranque/actualización anteriores omitiendo dc pull.
```

## Validación realizada y pendiente

En el entorno local: `docker compose ... config --quiet` y `bash -n` correctos;
35 pruebas unitarias backend aprobadas; typecheck y build frontend correctos;
lint termina con 9 advertencias existentes de Fast Refresh, sin errores.
El SW generado contiene NetworkOnly para API e importa el borrado de caché anterior.
`git diff --check` correcto. Pruebas HTTP sin BD confirman salud, rechazo de Origin
ajeno y flags de cookie segura (ver resultado de la preparación).

No se pudieron construir/arrancar imágenes ni ejecutar PostgreSQL: permiso denegado
al socket Docker incluso fuera del sandbox; sudo requiere contraseña. No hay
servidor PostgreSQL local alternativo disponible. Por tanto no se certifican aquí
117 pruebas, migraciones online desde cero, healthchecks Docker, proxy Nginx real,
restauración real, consumos de RAM ni inspección de capas de imágenes. El workflow
preparado aún no se ha ejecutado. La base de desarrollo permanece intacta.

Antes del despliegue, en una máquina con Docker, construir ambos Dockerfiles,
usar un proyecto de validación distinto con volumen nuevo y puerto loopback libre,
ejecutar `alembic upgrade head`/`current` y comprobar 0009. Para pytest usar otro
PostgreSQL desechable: el fixture DROP/CREATE/TRUNCATE de integración es destructivo;
NUNCA apuntar HICOTEA_TEST_DATABASE_URL a desarrollo o producción.
Inspeccionar imágenes (`docker create`, `docker export`, `tar -tf`) y todas sus capas
(`docker save`) para confirmar ausencia de `.env`, credenciales y herramientas dev.
Los contextos excluyen env y el runtime API solo copia app/migraciones/venv; runtime
web solo dist/nginx.conf. No se montan archivos de secretos dentro de las imágenes.
