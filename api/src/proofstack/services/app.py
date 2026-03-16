"""App service — each app is a compliance workspace with its own BB assistant."""

from __future__ import annotations

import json
import uuid
from datetime import datetime

from proofstack.core.backboard import register_app_in_registry
from proofstack.schemas.app import App


def _extract(memory) -> tuple[str | None, str | None]:
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


class AppService:
    """CRUD for apps stored in the user's personal BB assistant."""

    def __init__(self, client, user_assistant_id: str) -> None:
        self._client = client
        self._aid = user_assistant_id  # user's personal assistant

    async def _all_memories(self) -> list:
        resp = await self._client.get_memories(self._aid)
        return list(resp.memories) if hasattr(resp, "memories") else list(resp)

    # ------------------------------------------------------------------
    async def create_app(self, user_id: str, name: str, description: str = "") -> App:
        # Provision a dedicated BB assistant for this app's compliance data
        asst = await self._client.create_assistant(
            name=f"proofstack-app-{name[:40]}",
            system_prompt="Compliance data store for ProofStack app.",
        )
        app_assistant_id = str(asst.assistant_id)

        app = App(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            user_id=user_id,
            assistant_id=app_assistant_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await self._client.add_memory(
            assistant_id=self._aid,
            content=app.to_memory_content(),
        )
        await register_app_in_registry(app.id, app.assistant_id)
        return app

    async def get_app(self, app_id: str) -> App | None:
        for mem in await self._all_memories():
            content, _ = _extract(mem)
            if not content:
                continue
            try:
                data = json.loads(content)
                if data.get("id") == app_id:
                    return App.model_validate(data)
            except (json.JSONDecodeError, ValueError):
                continue
        return None

    async def list_apps(self) -> list[App]:
        apps = []
        for mem in await self._all_memories():
            content, _ = _extract(mem)
            if not content:
                continue
            try:
                data = json.loads(content)
                if data.get("id") and data.get("user_id"):
                    apps.append(App.model_validate(data))
            except (json.JSONDecodeError, ValueError):
                continue
        apps.sort(key=lambda a: a.created_at, reverse=True)
        return apps

    async def update_app(self, app_id: str, updates: dict) -> App | None:
        for mem in await self._all_memories():
            content, memory_id = _extract(mem)
            if not content or not memory_id:
                continue
            try:
                data = json.loads(content)
                if data.get("id") != app_id:
                    continue
                data.update(updates)
                data["updated_at"] = datetime.utcnow().isoformat()
                app = App.model_validate(data)
                await self._client.update_memory(
                    assistant_id=self._aid,
                    memory_id=str(memory_id),
                    content=app.to_memory_content(),
                )
                return app
            except (json.JSONDecodeError, ValueError):
                continue
        return None

    async def delete_app(self, app_id: str) -> bool:
        for mem in await self._all_memories():
            content, memory_id = _extract(mem)
            if not content or not memory_id:
                continue
            try:
                data = json.loads(content)
                if data.get("id") == app_id:
                    await self._client.delete_memory(
                        assistant_id=self._aid,
                        memory_id=str(memory_id),
                    )
                    return True
            except (json.JSONDecodeError, ValueError):
                continue
        return False
