"""Redirect: /me is now /auth/me. Kept for backward compat."""

from fastapi import APIRouter, Depends

from proofstack.core.auth import ROLE_PERMISSIONS, get_current_user
from proofstack.schemas.auth import CurrentUserRead
from proofstack.schemas.user import User

router = APIRouter()


@router.get("", response_model=CurrentUserRead)
async def get_me(user: User = Depends(get_current_user)):
    perms = sorted(ROLE_PERMISSIONS.get(user.role.value, []))
    return CurrentUserRead(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        permissions=perms,
        assistant_id=user.assistant_id,
    )
