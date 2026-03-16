"""Operational report schemas — workflow/campaign/vendor metrics."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WorkflowMetrics(BaseModel):
    onboarding_open: int = 0
    onboarding_closed: int = 0
    offboarding_open: int = 0
    offboarding_closed: int = 0
    policy_pending: int = 0
    policy_approved: int = 0
    policy_rejected: int = 0


class CampaignSummary(BaseModel):
    campaign_id: str
    name: str
    status: str
    total_subjects: int
    attested_count: int
    attestation_rate_pct: float
    overdue_count: int


class VendorRiskSummary(BaseModel):
    total_vendors: int
    by_tier: dict[str, int] = Field(default_factory=dict)
    expiring_docs_90d: int
    expiring_docs_30d: int


class AccessReviewSummary(BaseModel):
    total_campaigns: int
    active_campaigns: int
    closed_campaigns: int
    overall_coverage_pct: float | None = None


class OnboardingComplianceSummary(BaseModel):
    total_employees: int
    onboarding_complete: int
    onboarding_pending: int
    offboarding_complete: int
    offboarding_pending: int
