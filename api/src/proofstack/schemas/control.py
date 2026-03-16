"""Control catalog and mapping schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ControlMappingBase(BaseModel):
    tool_id: str
    external_control_id: str


class ControlMappingCreate(ControlMappingBase):
    control_catalog_id: UUID


class ControlMappingRead(ControlMappingBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    control_catalog_id: UUID
    created_at: datetime


class ControlCatalogBase(BaseModel):
    external_id: str
    title: str
    description: str | None = None
    framework: str


class ControlCatalogCreate(ControlCatalogBase):
    raw_oscal_jsonb: dict | None = None


class ControlCatalogUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    framework: str | None = None
    raw_oscal_jsonb: dict | None = None


class ControlCatalogRead(ControlCatalogBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    raw_oscal_jsonb: dict | None = None
    created_at: datetime
    updated_at: datetime


class ControlCatalogWithMappings(ControlCatalogRead):
    mappings: list[ControlMappingRead] = []
