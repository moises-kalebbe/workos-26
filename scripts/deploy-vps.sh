#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

APP_DIR=${APP_DIR:-$REPO_DIR}
STACK_NAME=${STACK_NAME:-workos}
IMAGE_NAME=${IMAGE_NAME:-ghcr.io/moi-kalebbe/workos-26:latest}
APP_SERVICE_NAME=${APP_SERVICE_NAME:-${STACK_NAME}_workos}

cd "$APP_DIR"

echo "[1/5] Validando arquivos obrigatorios"
test -f docker-stack.yml
test -f Dockerfile
test -f .env

echo "[2/5] Carregando variaveis do .env para o Swarm"
tmp_env=$(mktemp)
tr -d '\r' < .env > "$tmp_env"
set -a
. "$tmp_env"
set +a
rm -f "$tmp_env"

echo "[3/5] Buildando imagem local: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "[4/5] Atualizando stack"
docker stack deploy --resolve-image never --with-registry-auth -c docker-stack.yml "$STACK_NAME"

echo "[5/5] Servicos"
if docker service inspect "$APP_SERVICE_NAME" >/dev/null 2>&1; then
  echo "Forcando refresh do servico $APP_SERVICE_NAME para aplicar a imagem mais recente"
  docker service update --force "$APP_SERVICE_NAME" >/dev/null
fi
docker service ls | grep workos || true
