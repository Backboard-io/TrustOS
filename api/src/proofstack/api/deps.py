"""Shared dependencies."""

from fastapi import Depends, Header, HTTPException, status

from proofstack.core.auth import get_current_user
from proofstack.core.backboard import BackboardStore, get_assistant_id_by_app_id, get_client
from proofstack.schemas.user import User
from proofstack.services.app import AppService


async def get_store_by_app_id(app_id: str) -> BackboardStore:
    """Return a BackboardStore for the given app_id (for public trust routes; requires registry)."""
    assistant_id = await get_assistant_id_by_app_id(app_id)
    if not assistant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="App not found or public trust not enabled",
        )
    return BackboardStore(assistant_id)


async def get_store(
    x_app_id: str | None = Header(None, alias="X-App-ID"),
    current_user: User = Depends(get_current_user),
) -> BackboardStore:
    """Return a BackboardStore scoped to the app identified by X-App-ID header."""
    if not x_app_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-App-ID header required",
        )
    svc = AppService(get_client(), current_user.assistant_id)
    app = await svc.get_app(x_app_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="App not found or not accessible",
        )
    return BackboardStore(app.assistant_id)


# Alias for routes that import get_app_store explicitly
get_app_store = get_store


def get_global_store() -> BackboardStore:
    """Catalog data shared across all apps (controls, framework definitions).

    Always targets the global assistant (settings.backboard_assistant_id),
    regardless of which app the user has selected.
    """
    return BackboardStore()
