"""App schemas — a compliance workspace owned by a user."""

from datetime import datetime

from pydantic import BaseModel, Field


class App(BaseModel):
    id: str
    name: str
    description: str = ""
    user_id: str
    assistant_id: str  # this app's own BB assistant (stores compliance data)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_memory_content(self) -> str:
        return self.model_dump_json()


class AppCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""


class AppRead(BaseModel):
    id: str
    name: str
    description: str
    user_id: str
    assistant_id: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_app(cls, app: App) -> "AppRead":
        return cls(
            id=app.id,
            name=app.name,
            description=app.description,
            user_id=app.user_id,
            assistant_id=app.assistant_id,
            created_at=app.created_at,
            updated_at=app.updated_at,
        )
