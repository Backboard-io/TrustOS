"""Trust center schemas — public docs, NDA gate, questionnaire library."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TrustDocument(BaseModel):
    id: str
    title: str
    description: str | None = None
    s3_key: str
    is_public: bool = True
    requires_nda: bool = False
    created_at: datetime
    updated_at: datetime


class TrustDocumentCreate(BaseModel):
    title: str
    description: str | None = None
    s3_key: str
    is_public: bool = True
    requires_nda: bool = False


class TrustDocumentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_public: bool | None = None
    requires_nda: bool | None = None


class NDARecord(BaseModel):
    id: str
    email: str
    name: str | None = None
    signed_at: datetime
    access_token: str
    token_expires_at: datetime
    created_at: datetime


class NDASignCreate(BaseModel):
    email: str
    name: str | None = None


class NDAGrant(BaseModel):
    access_token: str
    token_expires_at: datetime
    documents: list[TrustDocument]


class SecurityQuestionTemplate(BaseModel):
    id: str
    question: str
    category: str | None = None
    order: int = 0


class QuestionAnswerEntry(BaseModel):
    id: str
    question_id: str
    answer: str
    category: str | None = None
    created_at: datetime
    updated_at: datetime


class QuestionnaireLibraryEntry(BaseModel):
    id: str
    title: str
    description: str | None = None
    questions: list[SecurityQuestionTemplate]
    created_at: datetime
    updated_at: datetime

    def to_memory_content(self) -> str:
        return self.model_dump_json()


class QuestionnaireLibraryCreate(BaseModel):
    title: str
    description: str | None = None
    questions: list[dict] = Field(..., description="List of {question, category?, order}")


class QuestionnaireLibraryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    questions: list[dict] | None = None
