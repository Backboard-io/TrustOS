"""Remediation ticket schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RemediationTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    result_id: UUID
    run_id: UUID | None = None  # populated when listing for link to run
    channel: str
    external_id: str
    status: str
    created_at: datetime


class RemediationSlackCreate(BaseModel):
    result_id: UUID
    message: str | None = None


class RemediationJiraCreate(BaseModel):
    result_id: UUID
    project_key: str
    summary: str | None = None
    description: str | None = None
