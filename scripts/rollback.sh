#!/usr/bin/env bash
# scripts/rollback.sh
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/your-org/saas-backend}"
COMPOSE_FILE="docker-compose.prod.yml"

if [[ -n "${1:-}" ]]; then
  ROLLBACK_TAG="$1"
elif [[ -f ".last_deploy_tag" ]]; then
  ROLLBACK_TAG=$(<.last_deploy_tag)
else
  echo "ERROR: No rollback tag provided and .last_deploy_tag is missing"
  exit 1
fi

echo "==> Rolling back to $REGISTRY:$ROLLBACK_TAG"
export IMAGE_TAG="$ROLLBACK_TAG" REGISTRY

docker compose -f "$COMPOSE_FILE" pull app
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate app

echo "==> Rollback complete: $REGISTRY:$ROLLBACK_TAG"
