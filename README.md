# ProofStack

MVP internal compliance automation platform for SOC 2 readiness. Replaces Vanta-style tooling with OSCAL as the canonical control model, Postgres + S3 for storage, and Temporal for recurring workflows.

## Stack

- **API:** Python 3.11+, uv, FastAPI, SQLAlchemy (async), Alembic, Pydantic, Temporal, boto3 (S3)
- **Frontend:** Node, Next.js 15, Tailwind CSS
- **Data:** Postgres (metadata), S3-compatible (evidence artifacts)
- **Integrations:** CloudQuery, Steampipe, Prowler, OPA/Rego, Checkov, Trivy, Slack, Jira

## Quick start

1. **Environment**
   - Copy `.env.example` to `api/.env` (or root `.env`) and set `DATABASE_URL` to your Postgres (e.g. `postgresql+asyncpg://user:pass@localhost:5432/proofstack`).
   - Optional: S3 vars for evidence and audit export; Temporal for automated runs.

2. **Database**
   ```bash
   cd api && uv sync && uv run alembic upgrade head
   uv run python scripts/load_oscal_catalog.py   # load SOC 2 TSC controls
   uv run python scripts/seed_rbac.py             # roles/permissions
   ```

3. **Run**
   - API: `cd api && uv run uvicorn proofstack.main:app --reload --port 8000`
   - Frontend: `cd frontend && npm install && npm run dev` (port 3000)
   - Or use `./start.sh` from repo root (clears only runtime/build caches, keeps .env and data).

4. **Temporal worker** (for Prowler/Steampipe/Checkov/Trivy runs)
   ```bash
   cd api && uv run python -m proofstack.workers.worker_main
   ```

## Features

- **Integrations dashboard** — Configure and trigger CloudQuery, Prowler, Steampipe, OPA, Checkov, Trivy, Slack, Jira.
- **Control library** — OSCAL-derived SOC 2 TSC controls; tool mappings for Prowler/Steampipe/etc.
- **Evidence vault** — Manual upload and list/download; S3-backed with checksums.
- **Automated checks** — Assessment runs (e.g. Prowler) via Temporal; pass/fail results per control.
- **Pass/fail history** — Per-control and global history of assessment results.
- **Slack/Jira remediation** — Create tickets from failed results; list remediation tickets.
- **Audit export** — Generate control-centric manifest (and optional S3 bundle) for a date range.
- **RBAC** — Roles (admin, auditor, remediator, viewer) and permissions; optional API-key auth; `GET /api/v1/me`.
- **Compliance posture dashboard** — Summary pass/fail and by-framework.

## API docs

- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
