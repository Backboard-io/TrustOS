"""Common schemas (health, pagination)."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    database: str
    s3: str | None = None
