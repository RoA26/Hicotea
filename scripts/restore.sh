#!/usr/bin/env bash
set -euo pipefail
umask 077
DEPLOY_DIR=${DEPLOY_DIR:-/opt/hicotea/deploy}
file=${1:?Uso: restore.sh /ruta/respaldo.dump}
[[ -f "$file" && -r "$file" ]] || { echo 'Dump no legible' >&2; exit 1; }
compose=(docker compose --env-file "$DEPLOY_DIR/.env.prod" -f "$DEPLOY_DIR/docker-compose.prod.yml")
"${compose[@]}" exec -T db pg_restore -l < "$file" > /dev/null
printf 'Se reemplazará la base hicotea de ESTE proyecto Compose. API y web quedarán detenidas.\n'
read -r -p 'Escribe RESTAURAR hicotea para confirmar: ' confirmation
[[ "$confirmation" == 'RESTAURAR hicotea' ]] || { echo 'Cancelado'; exit 1; }
# Antes de modificar, crear y verificar una copia de seguridad.
RETENTION_DAYS=0 "$(dirname "$0")/backup.sh"
"${compose[@]}" stop web api
"${compose[@]}" exec -T db pg_restore -U hicotea -d hicotea --clean --if-exists --no-owner --no-privileges --single-transaction < "$file"
echo 'Restaurado. Comprueba versión Alembic y compatibilidad de las imágenes antes de arrancar API y web.'
