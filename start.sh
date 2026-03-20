#!/usr/bin/env bash
# Clear only local runtime/build state; keep .env and persisted data. Then start the app.

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Load env so we can reference S3 vars
set -o allexport
# shellcheck disable=SC1091
[ -f .env ] && source .env
set +o allexport

S3_BUCKET="${S3_BUCKET:-proofstack-evidence}"
S3_ENDPOINT="${S3_ENDPOINT_URL:-http://localhost:4566}"
S3_REGION="${S3_REGION:-us-east-1}"

echo "==> Starting LocalStack (S3)..."
docker compose up -d localstack

echo "==> Waiting for LocalStack to be ready..."
until curl -s "${S3_ENDPOINT}/_localstack/health" | grep -q '"s3": "available"'; do
  sleep 1
done
echo "    LocalStack ready."

echo "==> Ensuring S3 bucket '${S3_BUCKET}' exists..."
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws --endpoint-url "${S3_ENDPOINT}" s3 mb "s3://${S3_BUCKET}" \
      --region "${S3_REGION}" 2>/dev/null || true
echo "    Bucket ready."

cleanup() {
  echo ""
  echo "==> Shutting down..."
  docker compose down --volumes --remove-orphans
  echo "    Shutdown complete."
}
trap cleanup EXIT SIGINT SIGTERM

echo "Starting API + web (single container, Docker)..."
docker compose up --build -d api

echo "Waiting for app on :8000 (API at /v1, web at /)..."
for i in {1..60}; do
  if curl -sf -o /dev/null http://localhost:8000/v1/health 2>/dev/null || curl -sf -o /dev/null http://localhost:8000/ 2>/dev/null; then
    break
  fi
  [[ $i -eq 60 ]] && echo "App did not become ready in time." && exit 1
  sleep 1
done
echo "App is up: http://localhost:8000"
docker compose logs -f api
~/PycharmProjects/ProofStack$ 