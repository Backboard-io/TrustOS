"""HIPAA Security Rule Phase 2 schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────────────────────────────────────
# PHI Assets
# ─────────────────────────────────────────────────────────────────────────────

class PHIAssetBase(BaseModel):
    name: str
    description: str | None = None
    data_classification: str = Field(..., description="e.g. ePHI, PHI, PII")
    system_owner: str
    location: str = Field(..., description="e.g. AWS RDS us-east-1, on-prem EHR")
    encryption_at_rest: bool = False
    encryption_in_transit: bool = False
    retention_period_days: int | None = None


class PHIAssetCreate(PHIAssetBase):
    pass


class PHIAssetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    data_classification: str | None = None
    system_owner: str | None = None
    location: str | None = None
    encryption_at_rest: bool | None = None
    encryption_in_transit: bool | None = None
    retention_period_days: int | None = None


class PHIAssetRead(PHIAssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# BAA Vendors
# ─────────────────────────────────────────────────────────────────────────────

BAAStatus = Literal["active", "expired", "pending"]


class BAAVendorBase(BaseModel):
    vendor_name: str
    contact_email: str | None = None
    services_provided: str | None = None
    baa_signed_date: str | None = Field(None, description="ISO date YYYY-MM-DD")
    baa_expiry_date: str | None = Field(None, description="ISO date YYYY-MM-DD")
    status: BAAStatus = "pending"
    s3_key: str | None = None


class BAAVendorCreate(BAAVendorBase):
    pass


class BAAVendorUpdate(BaseModel):
    vendor_name: str | None = None
    contact_email: str | None = None
    services_provided: str | None = None
    baa_signed_date: str | None = None
    baa_expiry_date: str | None = None
    status: BAAStatus | None = None
    s3_key: str | None = None


class BAAVendorRead(BAAVendorBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    days_until_expiry: int | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Training Records
# ─────────────────────────────────────────────────────────────────────────────

TrainingStatus = Literal["completed", "overdue", "pending"]


class TrainingRecordBase(BaseModel):
    user_email: str
    course_name: str
    due_at: str = Field(..., description="ISO date YYYY-MM-DD")
    completed_at: str | None = Field(None, description="ISO date YYYY-MM-DD")
    status: TrainingStatus = "pending"
    evidence_s3_key: str | None = None


class TrainingRecordCreate(TrainingRecordBase):
    pass


class TrainingRecordRead(TrainingRecordBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Risk Assessments
# ─────────────────────────────────────────────────────────────────────────────

RiskStatus = Literal["open", "mitigated", "accepted"]


class RiskAssessmentBase(BaseModel):
    title: str
    threat: str
    vulnerability: str
    likelihood: int = Field(..., ge=1, le=5, description="1 (low) to 5 (critical)")
    impact: int = Field(..., ge=1, le=5, description="1 (low) to 5 (critical)")
    mitigation: str | None = None
    status: RiskStatus = "open"
    phi_asset_id: str | None = None


class RiskAssessmentCreate(RiskAssessmentBase):
    pass


class RiskAssessmentUpdate(BaseModel):
    title: str | None = None
    threat: str | None = None
    vulnerability: str | None = None
    likelihood: int | None = Field(None, ge=1, le=5)
    impact: int | None = Field(None, ge=1, le=5)
    mitigation: str | None = None
    status: RiskStatus | None = None
    phi_asset_id: str | None = None


class RiskAssessmentRead(RiskAssessmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    risk_score: int
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Incidents
# ─────────────────────────────────────────────────────────────────────────────

IncidentStatus = Literal["open", "investigating", "resolved"]
IncidentSeverity = Literal["low", "medium", "high", "critical"]


class IncidentBase(BaseModel):
    title: str
    description: str
    phi_involved: bool = False
    discovered_at: datetime
    reported_at: datetime | None = None
    resolved_at: datetime | None = None
    status: IncidentStatus = "open"
    severity: IncidentSeverity
    breach_notification_required: bool = False


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    phi_involved: bool | None = None
    reported_at: datetime | None = None
    resolved_at: datetime | None = None
    status: IncidentStatus | None = None
    severity: IncidentSeverity | None = None
    breach_notification_required: bool | None = None


class IncidentRead(IncidentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Contingency Evidence
# ─────────────────────────────────────────────────────────────────────────────

ContingencyPlanType = Literal["backup", "dr", "emergency_mode", "testing", "revision"]
ContingencyResult = Literal["pass", "fail", "not_tested"]


class ContingencyEvidenceBase(BaseModel):
    plan_type: ContingencyPlanType
    description: str
    test_date: str = Field(..., description="ISO date YYYY-MM-DD")
    result: ContingencyResult = "not_tested"
    s3_key: str | None = None


class ContingencyEvidenceCreate(ContingencyEvidenceBase):
    pass


class ContingencyEvidenceUpdate(BaseModel):
    plan_type: ContingencyPlanType | None = None
    description: str | None = None
    test_date: str | None = None
    result: ContingencyResult | None = None
    s3_key: str | None = None


class ContingencyEvidenceRead(ContingencyEvidenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Access Reviews
# ─────────────────────────────────────────────────────────────────────────────

AccessDecision = Literal["approved", "revoked", "modified", "pending"]


class AccessReviewBase(BaseModel):
    reviewer_email: str
    reviewee_email: str
    system_name: str
    access_level: str
    review_date: str = Field(..., description="ISO date YYYY-MM-DD")
    next_review_date: str = Field(..., description="ISO date YYYY-MM-DD")
    decision: AccessDecision = "pending"


class AccessReviewCreate(AccessReviewBase):
    pass


class AccessReviewRead(AccessReviewBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Policy Acknowledgements
# ─────────────────────────────────────────────────────────────────────────────

class PolicyAcknowledgementBase(BaseModel):
    policy_name: str
    policy_version: str
    user_email: str
    acknowledged_at: datetime
    next_due_at: str = Field(..., description="ISO date YYYY-MM-DD")
    s3_key: str | None = None


class PolicyAcknowledgementCreate(PolicyAcknowledgementBase):
    pass


class PolicyAcknowledgementRead(PolicyAcknowledgementBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# HIPAA Audit Log
# ─────────────────────────────────────────────────────────────────────────────

class HIPAAAuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_email: str
    action: str
    resource_type: str
    resource_id: str | None = None
    timestamp: datetime
    ip_address: str | None = None
    outcome: Literal["success", "failure"] = "success"


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────

class SafeguardCategoryStatus(BaseModel):
    pass_count: int = Field(0, alias="pass")
    fail_count: int = Field(0, alias="fail")
    not_applicable_count: int = Field(0, alias="not_applicable")
    total: int = 0

    model_config = ConfigDict(populate_by_name=True)


class MissingEvidenceItem(BaseModel):
    control_id: str
    external_id: str | None = None
    title: str | None = None


class HIPAADashboardSummary(BaseModel):
    safeguard_status: dict[str, dict] = {}
    missing_evidence_controls: list[MissingEvidenceItem] = []
    overdue_training_count: int = 0
    expiring_baa_count: int = 0
    open_risk_count: int = 0
    open_incident_count: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# Audit export
# ─────────────────────────────────────────────────────────────────────────────

class HIPAAExportCreate(BaseModel):
    period_start: datetime
    period_end: datetime


class HIPAAExportRead(BaseModel):
    id: UUID
    period_start: datetime
    period_end: datetime
    bundle_s3_key: str
    created_at: datetime
    download_url: str | None = None
