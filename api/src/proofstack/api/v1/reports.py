"""Operational reports API — workflow, campaign, vendor, access-review metrics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from proofstack.api.deps import get_store
from proofstack.core.auth import require_permission
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.report import (
    AccessReviewSummary,
    CampaignSummary,
    OnboardingComplianceSummary,
    VendorRiskSummary,
    WorkflowMetrics,
)

router = APIRouter()


@router.get("/workflows", response_model=WorkflowMetrics)
async def get_workflow_metrics(
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    onboarding_runs = await store.list_workflow_runs("onboarding")
    offboarding_runs = await store.list_workflow_runs("offboarding")
    policy_requests = await store.list_policy_approval_requests()
    return WorkflowMetrics(
        onboarding_open=sum(1 for r in onboarding_runs if r.get("status") == "running"),
        onboarding_closed=sum(1 for r in onboarding_runs if r.get("status") == "completed"),
        offboarding_open=sum(1 for r in offboarding_runs if r.get("status") == "running"),
        offboarding_closed=sum(1 for r in offboarding_runs if r.get("status") == "completed"),
        policy_pending=sum(1 for r in policy_requests if r.get("status") == "pending"),
        policy_approved=sum(1 for r in policy_requests if r.get("status") == "approved"),
        policy_rejected=sum(1 for r in policy_requests if r.get("status") == "rejected"),
    )


@router.get("/campaigns", response_model=list[CampaignSummary])
async def get_campaign_summaries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    campaigns = await store.list_campaigns(skip=skip, limit=limit)
    out = []
    for c in campaigns:
        attestations = await store.list_attestations(c["id"])
        attested = len(attestations)
        total = max(attested, 1)
        rate = (attested / total * 100) if total else 0.0
        out.append(
            CampaignSummary(
                campaign_id=c["id"],
                name=c["name"],
                status=c.get("status", "draft"),
                total_subjects=total,
                attested_count=attested,
                attestation_rate_pct=rate,
                overdue_count=0,
            )
        )
    return out


@router.get("/vendors", response_model=VendorRiskSummary)
async def get_vendor_risk_summary(
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    vendors = await store.list_vendor_profiles(limit=1000)
    by_tier: dict[str, int] = {}
    for v in vendors:
        t = v.get("tier", "medium")
        by_tier[t] = by_tier.get(t, 0) + 1
    expiring_90 = len(await store.list_expiring_vendor_documents(within_days=90))
    expiring_30 = len(await store.list_expiring_vendor_documents(within_days=30))
    return VendorRiskSummary(
        total_vendors=len(vendors),
        by_tier=by_tier,
        expiring_docs_90d=expiring_90,
        expiring_docs_30d=expiring_30,
    )


@router.get("/access-reviews", response_model=AccessReviewSummary)
async def get_access_review_summary(
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    campaigns = await store.list_campaigns()
    active = sum(1 for c in campaigns if c.get("status") == "active")
    closed = sum(1 for c in campaigns if c.get("status") == "closed")
    total_attested = 0
    total_subjects = 0
    for c in campaigns:
        att = await store.list_attestations(c["id"])
        total_attested += len(att)
        total_subjects = max(total_subjects, len(att))
    coverage = (total_attested / total_subjects * 100) if total_subjects else None
    return AccessReviewSummary(
        total_campaigns=len(campaigns),
        active_campaigns=active,
        closed_campaigns=closed,
        overall_coverage_pct=coverage,
    )


@router.get("/onboarding", response_model=OnboardingComplianceSummary)
async def get_onboarding_compliance_summary(
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    employees = await store.list_employees(limit=1000)
    onboarding_runs = await store.list_workflow_runs("onboarding")
    offboarding_runs = await store.list_workflow_runs("offboarding")
    onboarding_complete = sum(1 for r in onboarding_runs if r.get("status") == "completed")
    onboarding_pending = sum(1 for r in onboarding_runs if r.get("status") == "running")
    offboarding_complete = sum(1 for r in offboarding_runs if r.get("status") == "completed")
    offboarding_pending = sum(1 for r in offboarding_runs if r.get("status") == "running")
    return OnboardingComplianceSummary(
        total_employees=len(employees),
        onboarding_complete=onboarding_complete,
        onboarding_pending=onboarding_pending,
        offboarding_complete=offboarding_complete,
        offboarding_pending=offboarding_pending,
    )
