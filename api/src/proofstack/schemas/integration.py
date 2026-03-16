"""Integration config schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IntegrationConfigBase(BaseModel):
    type: str
    name: str
    config: dict = {}
    credentials_ref: str | None = None
    enabled: bool = True


class IntegrationConfigCreate(IntegrationConfigBase):
    pass


class IntegrationConfigUpdate(BaseModel):
    name: str | None = None
    config: dict | None = None
    credentials_ref: str | None = None
    enabled: bool | None = None


class IntegrationConfigRead(IntegrationConfigBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class IntegrationConfigWithStatus(IntegrationConfigRead):
    last_run_id: UUID | None = None
    last_run_status: str | None = None
    last_run_at: datetime | None = None
