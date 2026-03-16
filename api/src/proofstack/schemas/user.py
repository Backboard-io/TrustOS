"""User schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"
    AUDITOR = "auditor"


class User(BaseModel):
    id: str
    email: str
    password_hash: str
    name: str
    role: UserRole = UserRole.USER
    assistant_id: str  # this user's personal BB assistant (stores their apps)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_memory_content(self) -> str:
        return self.model_dump_json()

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN


class UserCreate(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    name: str


class UserUpdate(BaseModel):
    email: str | None = None
    name: str | None = None
    role: UserRole | None = None


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    assistant_id: str
    created_at: datetime

    @classmethod
    def from_user(cls, user: "User") -> "UserPublic":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            assistant_id=user.assistant_id,
            created_at=user.created_at,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
