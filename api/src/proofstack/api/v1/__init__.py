"""API v1 routers."""

from fastapi import APIRouter

from proofstack.api.v1 import (
    admin,
    apps,
    audit_export,
    auth,
    controls,
    evidence,
    health,
    hipaa,
    integrations,
    me,
    posture,
    remediation,
    runs,
)
from proofstack.api.v1 import auditor, reports, trust
from proofstack.api.v1.workflows import campaigns, people, policies, vendors

api_router = APIRouter(prefix="/v1", tags=["v1"])

# Public / auth
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(me.router, prefix="/me", tags=["me"])

# App management (requires JWT, no X-App-ID needed)
api_router.include_router(apps.router, prefix="/apps", tags=["apps"])

# Admin (requires users:read / users:write permission)
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# Per-app data routes (requires JWT + X-App-ID header)
api_router.include_router(controls.router, prefix="/controls", tags=["controls"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["evidence"])
api_router.include_router(remediation.router, prefix="/remediation", tags=["remediation"])
api_router.include_router(audit_export.router, prefix="/audit-export", tags=["audit-export"])
api_router.include_router(posture.router, prefix="/posture", tags=["posture"])
api_router.include_router(hipaa.router, prefix="/hipaa", tags=["hipaa"])

# Phase 3 workflows
api_router.include_router(people.router, prefix="/workflows/people", tags=["workflows-people"])
api_router.include_router(campaigns.router, prefix="/workflows/campaigns", tags=["workflows-campaigns"])
api_router.include_router(policies.router, prefix="/workflows/policies", tags=["workflows-policies"])
api_router.include_router(vendors.router, prefix="/workflows/vendors", tags=["workflows-vendors"])

# Auditor, trust center, reports
api_router.include_router(auditor.router, prefix="/auditor", tags=["auditor"])
api_router.include_router(trust.router, prefix="/trust", tags=["trust"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
