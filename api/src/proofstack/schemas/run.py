"""Assessment run and result schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AssessmentResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    control_id: UUID
    result: str
    tool_id: str
    observation_details: dict | None = None
    created_at: datetime


class AssessmentRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    integration_config_id: UUID | None
    workflow_id: str | None
    started_at: datetime
    completed_at: datetime | None
    status: str
    trigger_metadata: dict | None = None


class AssessmentRunWithResults(AssessmentRunRead):
    results: list[AssessmentResultRead] = []


class AssessmentRunCreate(BaseModel):
    type: str = "manual"
    integration_config_id: UUID | None = None
    trigger_metadata: dict | None = None


class ControlHistoryEntry(BaseModel):
    """Single result in pass/fail history for a control."""
    run_id: UUID
    result: str
    tool_id: str
    created_at: datetime
