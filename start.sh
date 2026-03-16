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

API_PID=""
FE_PID=""

cleanup() {
  echo ""
  echo "==> Shutting down..."
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$FE_PID"  ] && kill "$FE_PID"  2>/dev/null || true
  docker compose down localstack --volumes --remove-orphans
}
trap cleanup EXIT SIGINT SIGTERM

echo "==> Starting API..."
if [ -d "api" ] && [ -f "api/pyproject.toml" ]; then
  (cd api && uv run uvicorn proofstack.main:app --reload --host 0.0.0.0 --port 8000) &
  API_PID=$!
fi

echo "==> Starting frontend..."
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  (cd frontend && npm install --legacy-peer-deps --silent && npm run dev) &
  FE_PID=$!
fi

echo ""
echo "API:      http://localhost:8000  |  Docs: http://localhost:8000/docs"
echo "Frontend: http://localhost:3000"
echo "S3:       ${S3_ENDPOINT}  (bucket: ${S3_BUCKET})"
echo "Press Ctrl+C to stop."
wait 2>/dev/null || true
