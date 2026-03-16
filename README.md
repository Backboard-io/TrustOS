# ReAssent

**Compliance automation for teams that ship fast.**

ReAssent is an open-source compliance platform that eliminates the busywork of SOC 2 and HIPAA audits. Connect your cloud, run automated scans, collect evidence, and hand auditors a ready-made bundle — all without a dedicated compliance team.

---

## Why ProofStack?

Most compliance tools cost $20–80k/year and still require months of manual work. ProofStack is self-hosted, framework-aware, and fully automated.

- **Automated evidence collection** — Prowler, Steampipe, Checkov, Trivy, and CloudQuery run on demand or on a schedule, mapping findings directly to controls.
- **Zero-database architecture** — All data lives in [Backboard](https://backboard.io) assistant memories. No Postgres to manage, no migrations.
- **Durable workflows** — Long-running scans and people processes run on Temporal, so nothing gets lost if a process crashes.
- **Auditor-ready exports** — Generate a signed JSON bundle with one click and share it via the built-in auditor portal.

---

## Frameworks Supported

| Framework | Status |
|---|---|
| SOC 2 TSC (AICPA) | ✅ Active |
| HIPAA Security Rule | ✅ Active |
| FedRAMP Moderate | 🔜 Coming soon |
| ISO 27001 | 🔜 Coming soon |
| PCI-DSS | 🔜 Coming soon |

---

## Feature Overview

### Control Library
Browse and filter controls by framework, track implementation status, and view cross-framework mappings and history.

### Assessment Runs
Trigger scans against your cloud environment (Prowler, Steampipe, Checkov, Trivy, CloudQuery). Results automatically map to controls and update your posture score.

### Evidence Vault
Upload and link evidence artifacts (screenshots, exports, configs) to specific controls or assessment runs. Stored in S3.

### Posture Dashboard
Live pass/fail/NA/error breakdown across your latest run, segmented by framework. Know your compliance posture in seconds.

### HIPAA Module
A dedicated workspace covering every operational requirement of the HIPAA Security Rule:

- PHI asset registry
- BAA vendor tracker
- Workforce training records
- Risk assessments
- Incident log
- Contingency plans
- Access reviews
- Policy acknowledgements
- HIPAA audit log
- HIPAA-specific evidence export

### Workflows
- **People lifecycle** — Onboarding/offboarding task checklists, driven by Temporal
- **Access review campaigns** — Schedule reviews, collect attestations
- **Policy approvals** — Route policies to approvers, track acknowledgements
- **Vendor management** — Track BAAs, document expiry alerts

### Remediation
Push failing control findings directly to Slack or Jira as remediation tickets.

### Auditor Portal
Invite auditors to a scoped workspace. They submit PBC (Provided By Client) requests, you fulfill them. No email chains, no shared drives.

### Trust Center
Public-facing security document portal. NDA-gated document release and a security questionnaire library for prospects and customers.

---

## Architecture

```
┌─────────────────────┐    ┌──────────────────────────┐
│   Next.js 15 UI     │───▶│   FastAPI (Python 3.11)  │
│  Tailwind + Radix   │    │   Pydantic v2 schemas     │
└─────────────────────┘    └────────────┬─────────────┘
                                        │
               ┌────────────────────────┼────────────────────┐
               │                        │                    │
       ┌───────▼──────┐      ┌──────────▼──────┐   ┌────────▼──────┐
       │  Backboard   │      │    Temporal      │   │   S3 / Local  │
       │  (data layer)│      │  (workflows)     │   │   Stack       │
       └──────────────┘      └─────────────────┘   └───────────────┘
```

**Backend:** FastAPI · Pydantic v2 · Backboard SDK · Temporal · boto3 · python-jose  
**Frontend:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · Chart.js · Radix UI  
**Infrastructure:** Docker Compose · LocalStack (dev S3) · Temporal

---

## Quickstart

### Prerequisites

- Docker + Docker Compose
- Node.js 20+
- Python 3.11+ with `uv` (`pip install uv`)
- A [Backboard](https://backboard.io) API key
- Temporal running locally (or pointed at a remote cluster)

### 1. Clone & configure

```bash
git clone https://github.com/your-org/reassent.git
cd reassent
cp .env.example .env
# Fill in BACKBOARD_API_KEY, SECRET_KEY, and S3 credentials
```

### 2. Start everything

```bash
./start.sh
```

This starts LocalStack (S3), creates the evidence bucket, runs the FastAPI server, and starts the Next.js frontend.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| LocalStack S3 | http://localhost:4566 |

### 3. Sign up and create your first workspace

Open [http://localhost:3000](http://localhost:3000), create an account, then create a **Compliance App** for the framework you're targeting (SOC 2 or HIPAA). Each workspace gets an isolated Backboard assistant — no data bleeds between workspaces.

---

## Environment Variables

```bash
# Backboard — primary data store
BACKBOARD_API_KEY=
BACKBOARD_ASSISTANT_ID=       # Global catalog assistant
USERS_ASSISTANT_ID=           # User record store
TRUST_ASSISTANT_ID=           # Optional: global trust center
REGISTRY_ASSISTANT_ID=        # Optional: app → assistant lookup

# Auth
SECRET_KEY=change-me-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60

# S3-compatible storage
S3_ENDPOINT_URL=http://localhost:4566
S3_REGION=us-east-1
S3_BUCKET=reassent-evidence
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# Temporal
TEMPORAL_HOST=localhost
TEMPORAL_PORT=7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=proofstack

# Integrations (optional)
SLACK_WEBHOOK_URL=
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
```

---

## RBAC

| Role | Access |
|---|---|
| `admin` | Full access — user management, all workspaces |
| `user` | Full read/write within their own apps |
| `viewer` | Read-only across controls, evidence, runs, posture |
| `auditor` | Scoped auditor portal — can view and upload PBC evidence |

---

## Automated Scanners

ProofStack dispatches these tools via Temporal workflows and maps results to controls automatically:

| Tool | What it scans |
|---|---|
| [Prowler](https://github.com/prowler-cloud/prowler) | AWS cloud security posture |
| [Steampipe](https://steampipe.io) | SQL-based cloud infrastructure queries |
| [Checkov](https://www.checkov.io) | Terraform, CloudFormation, and IaC |
| [Trivy](https://aquasecurity.github.io/trivy) | Container images and filesystem vulnerabilities |
| [CloudQuery](https://www.cloudquery.io) | Cloud asset inventory sync |

---

## Project Structure

```
ProofStack/
├── start.sh                   # One-command dev launcher
├── docker-compose.yml         # LocalStack
├── api/                       # FastAPI backend
│   └── src/proofstack/
│       ├── main.py            # App factory + router mount
│       ├── core/              # Config, auth, RBAC, Backboard store
│       ├── api/v1/            # All route handlers
│       ├── schemas/           # Pydantic models
│       ├── services/          # S3, Slack, Jira, audit export
│       └── workers/           # Temporal workflows + activities
└── frontend/                  # Next.js 15 app
    └── app/
        ├── components/        # Sidebar, AuthGuard, LayoutShell
        ├── contexts/          # Auth + app selection state
        └── [feature pages]    # controls, evidence, runs, hipaa, ...
```

---

## Contributing

Pull requests welcome. Open an issue before starting large features.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes with tests
4. Open a PR against `main`

---

## License

MIT © ReAssent Contributors
