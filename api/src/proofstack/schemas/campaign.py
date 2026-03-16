"""Access review campaign schemas — recurring campaigns and attestations."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AttestationOutcome = Literal["approved", "revoked", "no_change"]


class AccessReviewCampaign(BaseModel):
    id: str
    name: str
    description: str | None = None
    recurrence: str = Field(..., description="e.g. quarterly, monthly")
    status: Literal["draft", "active", "closed"] = "draft"
    due_at: str | None = Field(None, description="ISO date YYYY-MM-DD")
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None
    recurrence: str = "quarterly"
    due_at: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    recurrence: str | None = None
    due_at: str | None = None
    status: Literal["draft", "active", "closed"] | None = None


class ReviewerAttestation(BaseModel):
    id: str
    campaign_id: str
    reviewer_email: str
    subject_id: str = Field(..., description="user or system being reviewed")
    subject_type: Literal["user", "system"] = "user"
    outcome: AttestationOutcome
    comment: str | None = None
    attested_at: datetime
    created_at: datetime


class AttestationCreate(BaseModel):
    subject_id: str
    subject_type: Literal["user", "system"] = "user"
    outcome: AttestationOutcome
    comment: str | None = None


class CampaignResult(BaseModel):
    campaign_id: str
    total_subjects: int
    attested_count: int
    approved_count: int
    revoked_count: int
    no_change_count: int
    overdue_count: int
    closed_at: datetime | None = None
