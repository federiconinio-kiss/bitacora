#!/usr/bin/env bash
# Copia de seguridad de la base de Supabase.
# Uso: SUPABASE_DB_URL="postgresql://..." scripts/backup.sh [carpeta_destino]
# Genera dos archivos comprimidos:
#   app-AAAA-MM-DD.dump   → todas las tablas de la app (esquema y datos), formato de pg_restore
#   users-AAAA-MM-DD.sql  → los usuarios (logins) de Supabase Auth, sólo datos
set -euo pipefail
: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL}"
OUT="${1:-backups}"
DAY="$(date -u +%F)"
PG_DUMP="${PG_DUMP:-pg_dump}"
mkdir -p "$OUT"

"$PG_DUMP" "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges --format=custom --file="$OUT/app-$DAY.dump"
"$PG_DUMP" "$SUPABASE_DB_URL" --data-only --table=auth.users --table=auth.identities --no-owner --no-privileges --file="$OUT/users-$DAY.sql"
gzip -f "$OUT/users-$DAY.sql"

echo "Backup listo:"
ls -lh "$OUT"
