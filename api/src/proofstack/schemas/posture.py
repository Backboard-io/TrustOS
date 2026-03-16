"""Posture dashboard schemas."""

from pydantic import BaseModel


class PostureSummary(BaseModel):
    total_controls: int
    pass_count: int
    fail_count: int
    not_applicable_count: int
    error_count: int
    last_assessment_at: str | None  # ISO datetime or None


class PostureByFramework(BaseModel):
    framework: str
    total: int
    pass_count: int
    fail_count: int
    not_applicable_count: int
    error_count: int
