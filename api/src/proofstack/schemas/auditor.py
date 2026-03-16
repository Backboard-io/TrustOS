"""Auditor workspace and PBC (Provided By Client) request schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PBCStatus = Literal["open", "in_review", "fulfilled", "rejected"]


class AuditorWorkspace(BaseModel):
    id: str
    name: str
    description: str | None = None
    auditor_emails: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    def to_memory_content(self) -> str:
        return self.model_dump_json()


class AuditorWorkspaceCreate(BaseModel):
    name: str
    description: str | None = None
    auditor_emails: list[str] = Field(default_factory=list)


class AuditorWorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    auditor_emails: list[str] | None = None


class PBCRequest(BaseModel):
    id: str
    workspace_id: str
    title: str
    description: str | None = None
    due_at: str | None = Field(None, description="ISO date YYYY-MM-DD")
    created_at: datetime
    updated_at: datetime


class PBCItem(BaseModel):
    id: str
    request_id: str
    workspace_id: str
    title: str
    description: str | None = None
    status: PBCStatus = "open"
    s3_key: str | None = None
    fulfilled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PBCItemCreate(BaseModel):
    title: str
    description: str | None = None


class PBCItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: PBCStatus | None = None


class PBCFulfillCreate(BaseModel):
    s3_key: str
    notes: str | None = None
