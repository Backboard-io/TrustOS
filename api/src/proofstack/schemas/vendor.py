"""Vendor management schemas — tiering, questionnaires, document expiry."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


VendorTier = Literal["critical", "high", "medium", "low"]


class VendorProfile(BaseModel):
    id: str
    name: str
    contact_email: str | None = None
    tier: VendorTier = "medium"
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    def to_memory_content(self) -> str:
        return self.model_dump_json()


class VendorProfileCreate(BaseModel):
    name: str
    contact_email: str | None = None
    tier: VendorTier = "medium"
    description: str | None = None


class VendorProfileUpdate(BaseModel):
    name: str | None = None
    contact_email: str | None = None
    tier: VendorTier | None = None
    description: str | None = None


class QuestionnaireSection(BaseModel):
    id: str
    title: str
    questions: list[str]
    order: int = 0


class VendorQuestionnaire(BaseModel):
    id: str
    vendor_id: str
    title: str
    sections: list[QuestionnaireSection]
    created_at: datetime
    updated_at: datetime


class VendorQuestionnaireCreate(BaseModel):
    title: str
    sections: list[dict] = Field(..., description="List of {title, questions[], order}")


class QuestionnaireResponse(BaseModel):
    id: str
    questionnaire_id: str
    vendor_id: str
    answers: dict[str, str] = Field(default_factory=dict)
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime


class QuestionnaireResponseCreate(BaseModel):
    questionnaire_id: str
    answers: dict[str, str]


class VendorDocument(BaseModel):
    id: str
    vendor_id: str
    name: str
    doc_type: str = Field(..., description="e.g. BAA, SOC2, questionnaire")
    s3_key: str
    expiry_date: str | None = Field(None, description="ISO date YYYY-MM-DD")
    created_at: datetime
    updated_at: datetime


class VendorDocumentCreate(BaseModel):
    name: str
    doc_type: str
    s3_key: str
    expiry_date: str | None = None


class DocumentExpiryAlert(BaseModel):
    document_id: str
    vendor_id: str
    vendor_name: str
    name: str
    doc_type: str
    expiry_date: str
    days_until_expiry: int
