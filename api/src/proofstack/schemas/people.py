"""People workflow schemas — employee onboarding/offboarding."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EmployeeRecord(BaseModel):
    id: str
    email: str
    name: str
    department: str | None = None
    started_at: str | None = Field(None, description="ISO date YYYY-MM-DD")
    created_at: datetime
    updated_at: datetime

    def to_memory_content(self) -> str:
        return self.model_dump_json()


class EmployeeCreate(BaseModel):
    email: str
    name: str
    department: str | None = None
    started_at: str | None = None


class EmployeeUpdate(BaseModel):
    email: str | None = None
    name: str | None = None
    department: str | None = None
    started_at: str | None = None


TaskStatus = Literal["pending", "in_progress", "completed"]


class OnboardingTask(BaseModel):
    id: str
    employee_id: str
    title: str
    description: str | None = None
    status: TaskStatus = "pending"
    due_at: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class OnboardingTaskCreate(BaseModel):
    title: str
    description: str | None = None
    due_at: str | None = None


class OffboardingTask(BaseModel):
    id: str
    employee_id: str
    title: str
    description: str | None = None
    status: TaskStatus = "pending"
    due_at: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class OffboardingTaskCreate(BaseModel):
    title: str
    description: str | None = None
    due_at: str | None = None


class TaskCompletion(BaseModel):
    id: str
    task_id: str
    task_type: Literal["onboarding", "offboarding"]
    completed_at: datetime
    evidence_s3_key: str | None = None
    notes: str | None = None
    created_at: datetime


class TaskCompletionCreate(BaseModel):
    task_id: str
    task_type: Literal["onboarding", "offboarding"]
    evidence_s3_key: str | None = None
    notes: str | None = None


class OnboardingCreate(BaseModel):
    employee_id: str
    task_titles: list[str] = Field(default_factory=lambda: ["IT access provisioning", "Security training acknowledgement", "NDA signing"])


class OffboardingCreate(BaseModel):
    employee_id: str
    task_titles: list[str] = Field(default_factory=lambda: ["Revoke system access", "Return equipment", "NDA / confidentiality reminder"])
