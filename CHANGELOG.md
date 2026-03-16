# Changelog

All notable changes to ProofStack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-03-16

### Added

- **Compliance Hub** — home screen with module selection for SOC 2, HIPAA, and cross-framework work
- **SOC 2 TSC module** — AICPA Trust Services Criteria control tracking with 15 controls, posture history, and remediation workflows
- **HIPAA module** — PHI asset registry, BAA management, access reviews, incident tracking, policy management, training, risk assessments, and contingency planning
- **Controls** — individual control detail pages with evidence attachment, history timeline, and status management
- **Audit runs** — automated compliance run execution with per-control pass/fail results and audit trail
- **Evidence management** — evidence upload, linking to controls, and export workflows
- **Vendor management** — vendor inventory with compliance tracking
- **Policy management** — policy library with versioning and review workflows
- **People & access reviews** — user roster and periodic access review workflows
- **Reports** — compliance posture reports and export
- **Trust portal** — public-facing trust center page
- **Admin panel** — workspace configuration and user management
- **Integrations** — third-party integration connection hub
- **Sidebar navigation** — collapsible sidebar with module-aware routing
- **Dark mode** — full light/dark theme toggle via `next-themes`
- **Auth** — login, signup, and route-level auth guard
- **Backboard integration** — AI assistant powered by Backboard SDK for cross-framework queries
- **Version badge** — `v0.1.0` displayed at bottom center of the application shell

### Infrastructure

- Next.js 15 + React 19 frontend with Tailwind CSS and shadcn/ui components
- FastAPI backend (`proofstack` package) with Pydantic models throughout
- Backboard-backed assistant and document storage
- Docker Compose local development stack
- `start.sh` with trap-on-exit process management and clean runtime reset

---

<!-- next release goes above this line -->
