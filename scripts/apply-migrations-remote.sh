#!/usr/bin/env bash
set -euo pipefail

# Aplica migrations SQL pendentes no Postgres da VPS de forma idempotente.
# Rastreia migrations aplicadas via tabela `schema_migrations`.
#
# Uso (na VPS, apos SCP da pasta sql/migrations):
#   MIG_DIR=/tmp/workos-migrations ./apply-migrations-remote.sh
#
# Variaveis suportadas (com defaults):
#   MIG_DIR            pasta com os arquivos *.sql  (obrigatorio)
#   POSTGRES_CONTAINER workos-postgres
#   DB_USER            workos-user
#   DB_NAME            workos-db

MIG_DIR="${MIG_DIR:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-workos_workos-postgres}"
POSTGRES_IMAGE_MATCH="${POSTGRES_IMAGE_MATCH:-postgres:17-alpine}"
DB_USER="${DB_USER:-workos-user}"
DB_NAME="${DB_NAME:-workos-db}"

if [ -z "${MIG_DIR}" ] || [ ! -d "${MIG_DIR}" ]; then
  echo "[migrate] MIG_DIR nao setado ou nao existe: '${MIG_DIR}'" >&2
  exit 1
fi

# Em Docker Swarm, container_name do compose eh ignorado. Resolvemos o
# container id real procurando por:
#   1) nome/id passado explicito em POSTGRES_CONTAINER
#   2) nome que comeca com a service (ex: workos_workos-postgres.1.abcd)
#   3) ancestor que bate com a imagem do postgres
resolve_postgres_container() {
  if [ -n "${POSTGRES_CONTAINER}" ] && docker ps --format '{{.Names}}' | grep -Fxq "${POSTGRES_CONTAINER}"; then
    echo "${POSTGRES_CONTAINER}"
    return 0
  fi

  local by_service
  by_service="$(docker ps --filter "name=${POSTGRES_SERVICE}" --format '{{.ID}}' | head -n 1 || true)"
  if [ -n "${by_service}" ]; then
    echo "${by_service}"
    return 0
  fi

  local by_image
  by_image="$(docker ps --filter "ancestor=${POSTGRES_IMAGE_MATCH}" --format '{{.ID}}' | head -n 1 || true)"
  if [ -n "${by_image}" ]; then
    echo "${by_image}"
    return 0
  fi

  return 1
}

if ! POSTGRES_CONTAINER="$(resolve_postgres_container)"; then
  echo "[migrate] nao encontrei o container do Postgres. containers em execucao:" >&2
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' >&2 || true
  exit 1
fi
echo "[migrate] usando container ${POSTGRES_CONTAINER}"

psql_cmd() {
  docker exec -i "${POSTGRES_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" "$@"
}

echo "[migrate] garantindo tabela schema_migrations"
table_preexisted="$(psql_cmd -tA -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations') THEN 1 ELSE 0 END" 2>/dev/null | tr -d '[:space:]' || echo 0)"
psql_cmd <<'SQL' >/dev/null
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# Bootstrap: na primeira vez que a tabela eh criada, marca como aplicadas
# as migrations que ja foram rodadas manualmente em producao antes do tracking.
if [ "${table_preexisted}" = "0" ]; then
  bootstrap_file="${MIG_DIR}/.applied-before-tracking"
  if [ -f "${bootstrap_file}" ]; then
    echo "[migrate] bootstrap: marcando migrations antigas como aplicadas a partir de ${bootstrap_file}"
    while IFS= read -r line; do
      line="$(echo "${line}" | tr -d '\r' | awk '{$1=$1}1')"
      [ -z "${line}" ] && continue
      case "${line}" in \#*) continue;; esac
      if ! [[ "${line}" =~ ^[A-Za-z0-9._-]+$ ]]; then continue; fi
      psql_cmd -c "INSERT INTO schema_migrations (filename) VALUES ('${line}') ON CONFLICT DO NOTHING" >/dev/null
    done < "${bootstrap_file}"
  fi
fi

shopt -s nullglob
files=( "${MIG_DIR}"/*.sql )
shopt -u nullglob
if [ "${#files[@]}" -eq 0 ]; then
  echo "[migrate] nenhum arquivo .sql em ${MIG_DIR}"
  exit 0
fi

IFS=$'\n' sorted=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

applied=0
skipped=0

for file in "${sorted[@]}"; do
  name="$(basename "${file}")"
  # Valida nome para evitar injecao na query de lookup
  if ! [[ "${name}" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "[migrate] pulando nome suspeito: ${name}" >&2
    continue
  fi

  exists="$(psql_cmd -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '${name}' LIMIT 1" 2>/dev/null || true)"
  if [ "${exists}" = "1" ]; then
    echo "[migrate] skip  ${name}"
    skipped=$((skipped + 1))
    continue
  fi

  echo "[migrate] apply ${name}"
  psql_cmd < "${file}"
  psql_cmd -c "INSERT INTO schema_migrations (filename) VALUES ('${name}') ON CONFLICT DO NOTHING" >/dev/null
  applied=$((applied + 1))
done

echo "[migrate] concluido. aplicadas=${applied} puladas=${skipped}"
