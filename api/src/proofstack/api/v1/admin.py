"""Admin routes — user management and cross-user app listing."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from proofstack.core.auth import require_permission
from proofstack.core.backboard import get_client
from proofstack.schemas.app import AppRead
from proofstack.schemas.user import User, UserPublic, UserRole
from proofstack.services.app import AppService
from proofstack.services.user import UserService

router = APIRouter()


def _user_svc() -> UserService:
    return UserService(get_client())


@router.get("/users", response_model=list[UserPublic])
async def list_users(
    _: User = Depends(require_permission("users:read")),
    svc: UserService = Depends(_user_svc),
):
    users = await svc.list_users()
    return [UserPublic.from_user(u) for u in users]


class UserAdminUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: UserRole | None = None


@router.patch("/users/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: str,
    body: UserAdminUpdate,
    _: User = Depends(require_permission("users:write")),
    svc: UserService = Depends(_user_svc),
):
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.email is not None:
        updates["email"] = body.email.strip()
    if body.role is not None:
        updates["role"] = body.role.value
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    user = await svc.update_user(user_id, updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic.from_user(user)


class AppWithOwner(AppRead):
    owner_email: str
    owner_name: str


@router.get("/apps", response_model=list[AppWithOwner])
async def list_all_apps(
    _: User = Depends(require_permission("users:read")),
    svc: UserService = Depends(_user_svc),
):
    """List every app across all users."""
    users = await svc.list_users()
    all_apps: list[AppWithOwner] = []

    for user in users:
        if not user.assistant_id:
            continue
        app_svc = AppService(get_client(), user.assistant_id)
        try:
            apps = await app_svc.list_apps()
        except Exception:
            continue
        for app in apps:
            all_apps.append(
                AppWithOwner(
                    id=app.id,
                    name=app.name,
                    description=app.description,
                    user_id=app.user_id,
                    assistant_id=app.assistant_id,
                    created_at=app.created_at,
                    updated_at=app.updated_at,
                    owner_email=user.email,
                    owner_name=user.name,
                )
            )

    all_apps.sort(key=lambda a: a.created_at, reverse=True)
    return all_apps
