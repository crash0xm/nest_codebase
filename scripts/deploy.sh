#!/usr/bin/env bash
# scripts/deploy.sh
set -euo pipefail

IMAGE_TAG="${1:?Missing image tag. Example: ./scripts/deploy.sh abc1234}"
ENV_FILE="${2:-.env.docker}"
REGISTRY="${REGISTRY:-ghcr.io/your-org/saas-backend}"
COMPOSE_FILE="docker-compose.prod.yml"

echo "==> Deploying $REGISTRY:$IMAGE_TAG"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing env file: $ENV_FILE"
  exit 1
fi

export IMAGE_TAG REGISTRY

echo "==> Pulling image..."
docker compose -f "$COMPOSE_FILE" pull app

echo "==> Running database migration..."
docker compose -f "$COMPOSE_FILE" run --rm \
  -e DATABASE_URL \
  app sh -c "node_modules/.bin/prisma migrate deploy"

echo "==> Restarting app..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate app

echo "==> Waiting for health check..."
MAX_RETRIES=12
RETRY=0
until curl -sf "http://localhost:${PORT:-3000}/api/v1/health" > /dev/null; do
  RETRY=$((RETRY + 1))
  if [[ $RETRY -ge $MAX_RETRIES ]]; then
    echo "ERROR: Health check failed after ${MAX_RETRIES} attempts. Triggering rollback..."
    bash "$(dirname "$0")/rollback.sh"
    exit 1
  fi
  echo "  Waiting... ($RETRY/$MAX_RETRIES)"
  sleep 5
done

echo "$IMAGE_TAG" > .last_deploy_tag
echo "==> Deploy successful: $REGISTRY:$IMAGE_TAG"
