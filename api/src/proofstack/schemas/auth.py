"""Auth and current user schemas."""

from pydantic import BaseModel


class CurrentUserRead(BaseModel):
    id: str
    email: str
    name: str
    role: str
    permissions: list[str]
    assistant_id: str


class LoginRequest(BaseModel):
    email: str
    password: str
