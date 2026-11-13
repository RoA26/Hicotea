#!/usr/bin/env bash
set -euo pipefail
umask 077
DEPLOY_DIR=${DEPLOY_DIR:-/opt/hicotea/deploy}
BACKUP_DIR=${BACKUP_DIR:-/opt/hicotea/backups}
RETENTION_DAYS=${RETENTION_DAYS:-14}
[[ "$RETENTION_DAYS" =~ ^(0|[1-9][0-9]*)$ ]] || { echo 'Retención inválida' >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
compose=(docker compose --env-file "$DEPLOY_DIR/.env.prod" -f "$DEPLOY_DIR/docker-compose.prod.yml")
file="$BACKUP_DIR/hicotea-$(date -u +%Y%m%dT%H%M%S)-$$.dump"
trap 'echo "Respaldo incompleto: revise el archivo .partial si existe" >&2' ERR
"${compose[@]}" exec -T db pg_dump -U hicotea -d hicotea -Fc > "$file.partial"
"${compose[@]}" exec -T db pg_restore -l < "$file.partial" > /dev/null
mv "$file.partial" "$file"
# Solo dumps propios ya verificados; nunca borrar la copia recién creada.
if (( RETENTION_DAYS > 0 )); then
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hicotea-*.dump' ! -path "$file" -mtime +"$RETENTION_DAYS" -delete
fi
printf 'Respaldo verificado: %s\n' "$file"
