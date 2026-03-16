"""Policy approval workflow schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PolicyApprovalStatus = Literal["pending", "approved", "rejected"]


class PolicyVersion(BaseModel):
    id: str
    policy_id: str
    version: str
    title: str
    s3_key: str
    created_at: datetime
    updated_at: datetime


class PolicyApprovalRequest(BaseModel):
    id: str
    policy_id: str
    version_id: str
    title: str
    status: PolicyApprovalStatus = "pending"
    submitted_at: datetime
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PolicyApprovalRequestCreate(BaseModel):
    policy_id: str
    version_id: str
    title: str
    s3_key: str


class PolicyApprovalDecision(BaseModel):
    id: str
    request_id: str
    approver_email: str
    decision: Literal["approved", "rejected"]
    comment: str | None = None
    decided_at: datetime
    created_at: datetime


class PolicyApprovalCreate(BaseModel):
    decision: Literal["approved", "rejected"]
    comment: str | None = None


class PolicyApprovalHistoryEntry(BaseModel):
    request_id: str
    approver_email: str
    decision: Literal["approved", "rejected"]
    comment: str | None = None
    decided_at: datetime
