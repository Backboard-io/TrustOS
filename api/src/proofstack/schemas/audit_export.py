"""Audit export schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditExportCreate(BaseModel):
    period_start: datetime
    period_end: datetime


class AuditExportBundleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    period_start: datetime
    period_end: datetime
    manifest: dict
    bundle_s3_key: str
    created_at: datetime


class AuditExportBundleWithUrl(AuditExportBundleRead):
    download_url: str | None = None
