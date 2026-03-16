"""Evidence artifact schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EvidenceArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID | None
    control_id: UUID | None
    file_name: str
    s3_key: str
    content_type: str
    uploaded_at: datetime
    uploaded_by: UUID | None
    checksum: str | None


class EvidenceArtifactUploadResponse(BaseModel):
    id: UUID
    file_name: str
    s3_key: str
    content_type: str
    uploaded_at: datetime
