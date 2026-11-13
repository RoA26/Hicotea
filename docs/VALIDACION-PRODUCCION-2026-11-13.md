# Validación de producción — 2026-11-13

Estado: incompleta y bloqueada por acceso al daemon desde la sesión del agente.
No se certifica una versión desplegable ni se ha levantado localhost:18091.

## Evidencia del bloqueo

`docker info` devuelve `permission denied ... unix:///var/run/docker.sock`, tanto
en ejecución normal como solicitando ejecución fuera del sandbox. El cliente
reporta 29.9.3 y Compose 5.7.0; no se pudo consultar la versión del servidor.
`id` en esta sesión devuelve uid 1000, grupos atenea y nobody; `getent group
docker` sí incluye atenea (gid 962). El socket se presenta como `nobody:nobody`.
`sudo -n docker info` requiere contraseña. La sesión de terminal del propietario
con `newgrp docker` no se refleja en estos procesos del agente.

No se cambiaron permisos, grupos, archivos .env, Compose, contenedores ni bases.
No hubo conexión a Dante, commits, pushes ni limpiezas Docker.

## Resultados ejecutados

| Comprobación | Resultado |
|---|---|
| Backend, `pytest tests/unidad -q` | 35 aprobadas, 0 fallidas, 0 omitidas |
| Suite, `pytest --collect-only -q` | 117 recogidas; 82 de integración sin ejecutar |
| Frontend, `pnpm exec tsc -b` | Correcto |
| Frontend, `pnpm lint` | 0 errores; 9 advertencias Fast Refresh |
| Frontend, `pnpm build` | Correcto; Vite 8.3.7, SW generado |
| SW generado | Incluye NetworkOnly e import de sw-privacy.js |
| Callback activate de sw-privacy.js | Ejecutado en VM de Node con Cache Storage simulado; elimina hicotea-api |
| `bash -n scripts/backup.sh scripts/restore.sh` | Correcto |
| `git diff --check` | Correcto antes de añadir este informe |

Los comandos pytest recibieron explícitamente una URL ficticia al puerto 1,
sin secretos reales, para impedir cualquier conexión accidental a desarrollo.
La recogida no ejecuta los fixtures destructivos de integración. Las 82 pendientes
no se cuentan como omitidas por pytest. Un intento adicional con TestClient quedó
bloqueado y fue interrumpido; no se atribuyen resultados HTTP a ese intento.

## Pendiente de Docker y navegador

No construidas las imágenes: tamaños, capas, contenido y ausencia de secretos
sin verificar. La revisión de Dockerfiles muestra builds multietapa y contextos
con listas permitidas; no sustituye inspeccionar las imágenes y sus capas.
No se ejecutaron migraciones online: 0009 existe en el árbol, no se certifica head
en ninguna base. Healthchecks, rutas por Nginx, registro/login, cookies, Origin,
aislamiento entre usuarios, ingresos, gastos, cajitas, metas, ahorro y Calendario
Vivo pendientes de ejecución real en el entorno aislado.

No se midieron memoria ni CPU, tampoco durante Argon2. Los límites declarados
(DB 384 MiB, API 256 MiB, web 64 MiB) siguen sin validación empírica. Falta probar
persistencia mediante reinicio y backup/restore sobre datos descartables.
`ss` informó restricciones de netlink: no se certifica disponibilidad de 18091.

La inspección estática muestra Caddy sobrescribiendo X-Real-IP con remote_host,
Nginx reemplazando X-Forwarded-For con ese X-Real-IP y Uvicorn confiando en todos
los proxies. Esta cadena depende de que el puerto de Nginx solo admita el ingreso
local de confianza y de que la configuración documentada de Caddy se aplique.
Falta ensayar headers falsificados desde el ingreso Caddy y comprobar que los
límites de login siguen contando la misma IP. No se modificó Caddy ni Bastión.

La política PWA y el borrado se verificaron en código generado y VM; falta un
navegador con caché previa, actualización del worker y pruebas offline financieras.

Para probar backup/restore sin tocar producción se puede usar DEPLOY_DIR apuntando
a un directorio temporal que contenga un docker-compose.prod.yml temporal con
`name: hicotea-validation` y credenciales desechables en su propio .env.prod.
Los scripts admiten esa variable. Antes de ejecutarlos hay que comprobar las
etiquetas Compose de los contenedores y el volumen; no se ha ejecutado esa prueba.

## Riesgos

Bloqueante para certificar producción: falta toda la validación Docker indicada.
No iniciar despliegue basándose en este informe.

Observaciones pendientes de aceptación: contadores de login en memoria se pierden
al reiniciar; recuperación emite PIN en logs y registro/recuperación no tienen
límites globales o por IP; concurrencia Argon2 puede superar el presupuesto API.
Las bases usan tags mutables. Las nueve advertencias de lint no bloquean el build.

No se realizaron correcciones de infraestructura sin evidencia de un fallo real.
Se añadió únicamente este informe; se preservaron los cambios de producto.

## Comandos de despliegue (condicionados a completar la validación)

El procedimiento completo, transferencia, secretos, imágenes y Caddy está en
[DEPLOYMENT.md](DEPLOYMENT.md). No existe todavía una imagen validada cuyo tag
o digest pueda proporcionarse honestamente. Después de validar y transferir las
imágenes exactas, con ambos identificadores configurados en .env.prod, el primer
arranque en Dante sería el siguiente. Son instrucciones para el propietario;
el agente no las ejecutó:

```bash
cd /opt/hicotea/deploy
dc() { docker compose --env-file .env.prod -f docker-compose.prod.yml "$@"; }
dc config --quiet
dc pull  # Omitir si se usó docker load con las imágenes validadas.
dc up -d --wait db
dc run --rm --no-deps api alembic upgrade head
dc run --rm --no-deps api alembic current  # Debe indicar 0009 (head).
dc up -d --wait api web
dc ps
curl --fail http://127.0.0.1:8091/healthz
curl --fail http://127.0.0.1:8091/api/salud
curl -i http://127.0.0.1:8091/api/auth/yo  # Esperado: 401.
```

Para una instalación existente seguir la secuencia de actualización del documento:
detener escritores y respaldar antes de migrar; no usar esta secuencia de primer
arranque como sustituto de una actualización con respaldo.
