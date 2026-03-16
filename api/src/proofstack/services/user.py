"""User service — Backboard-backed user management."""

from __future__ import annotations

import json
import uuid
from datetime import datetime

import bcrypt as _bcrypt

from proofstack.core.config import settings
from proofstack.schemas.user import User, UserRole


def _hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _verify(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())


def _extract(memory) -> tuple[str | None, str | None]:
    """Return (content, memory_id) from a Backboard memory object."""
    if isinstance(memory, dict):
        payload = memory
    elif hasattr(memory, "model_dump"):
        payload = memory.model_dump()
    else:
        payload = {}

    content = payload.get("content") or payload.get("text") or payload.get("value")
    memory_id = payload.get("memory_id") or payload.get("id") or payload.get("memoryId")

    if content is None and hasattr(memory, "content"):
        content = memory.content
    if memory_id is None:
        for attr in ("memory_id", "id", "memoryId"):
            if hasattr(memory, attr):
                memory_id = getattr(memory, attr)
                break

    return content, memory_id


class UserService:
    """CRUD for users stored in the auth (USERS_ASSISTANT_ID) Backboard assistant."""

    def __init__(self, client) -> None:
        self._client = client
        self._aid = settings.users_assistant_id

    async def _all_memories(self) -> list:
        resp = await self._client.get_memories(self._aid)
        return list(resp.memories) if hasattr(resp, "memories") else list(resp)

    # ------------------------------------------------------------------
    async def create_user(
        self,
        email: str,
        password: str,
        name: str,
        role: UserRole = UserRole.VIEWER,
        personal_assistant_id: str = "",
    ) -> User:
        existing = await self.get_by_email(email)
        if existing:
            raise ValueError(f"Email {email} already registered")

        user = User(
            id=str(uuid.uuid4()),
            email=email.lower().strip(),
            password_hash=_hash(password),
            name=name.strip(),
            role=role,
            assistant_id=personal_assistant_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await self._client.add_memory(
            assistant_id=self._aid,
            content=user.to_memory_content(),
        )
        return user

    async def authenticate(self, email: str, password: str) -> User | None:
        user = await self.get_by_email(email)
        if not user:
            return None
        if not _verify(password, user.password_hash):
            return None
        return user

    async def get_by_id(self, user_id: str) -> User | None:
        for mem in await self._all_memories():
            content, _ = _extract(mem)
            if not content:
                continue
            try:
                data = json.loads(content)
                if data.get("id") == user_id:
                    return User.model_validate(data)
            except (json.JSONDecodeError, ValueError):
                continue
        return None

    async def get_by_email(self, email: str) -> User | None:
        email_lower = email.lower().strip()
        for mem in await self._all_memories():
            content, _ = _extract(mem)
            if not content:
                continue
            try:
                data = json.loads(content)
                if data.get("email", "").lower() == email_lower:
                    return User.model_validate(data)
            except (json.JSONDecodeError, ValueError):
                continue
        return None

    async def list_users(self) -> list[User]:
        users = []
        for mem in await self._all_memories():
            content, _ = _extract(mem)
            if not content:
                continue
            try:
                data = json.loads(content)
                if data.get("id"):
                    users.append(User.model_validate(data))
            except (json.JSONDecodeError, ValueError):
                continue
        return users

    async def update_user(self, user_id: str, updates: dict) -> User | None:
        for mem in await self._all_memories():
            content, memory_id = _extract(mem)
            if not content or not memory_id:
                continue
            try:
                data = json.loads(content)
                if data.get("id") != user_id:
                    continue
                if "email" in updates:
                    updates["email"] = updates["email"].lower().strip()
                data.update(updates)
                data["updated_at"] = datetime.utcnow().isoformat()
                user = User.model_validate(data)
                await self._client.update_memory(
                    assistant_id=self._aid,
                    memory_id=str(memory_id),
                    content=user.to_memory_content(),
                )
                return user
            except (json.JSONDecodeError, ValueError):
                continue
        return None

    async def count(self) -> int:
        return len(await self.list_users())
