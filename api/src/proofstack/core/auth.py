"""JWT token utilities and FastAPI get_current_user dependency."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt

from proofstack.core.config import settings
from proofstack.schemas.user import User, UserRole


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role.value,
        "assistant_id": user.assistant_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_current_user(
    authorization: str | None = Header(None),
) -> User:
    """Extract and validate the Bearer JWT; return the user payload as a User."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Reconstruct a lightweight User from the token claims (no DB round-trip per request)
    return User(
        id=user_id,
        email=payload.get("email", ""),
        password_hash="",
        name=payload.get("name", ""),
        role=UserRole(payload.get("role", "viewer")),
        assistant_id=payload.get("assistant_id", ""),
    )


# ---------------------------------------------------------------------------
# Role-based permission check (unchanged from existing rbac logic)
# ---------------------------------------------------------------------------

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": [
        "controls:read", "controls:write",
        "evidence:read", "evidence:write",
        "runs:read", "runs:write",
        "integrations:read", "integrations:write",
        "remediation:read", "remediation:write",
        "audit:export", "posture:read",
        "users:read", "users:write",
        "apps:read", "apps:write",
        "auditor:read", "auditor:write",
    ],
    # user: can create and manage their own apps, full read access
    "user": [
        "controls:read", "controls:write",
        "evidence:read", "evidence:write",
        "runs:read", "runs:write",
        "integrations:read", "integrations:write",
        "remediation:read", "remediation:write",
        "audit:export", "posture:read",
        "apps:read", "apps:write",
    ],
    # viewer: read-only across everything, no mutations
    "viewer": [
        "controls:read",
        "evidence:read",
        "runs:read",
        "integrations:read",
        "remediation:read",
        "posture:read",
        "apps:read",
    ],
    # auditor: read-only on auditor workspace/portal only
    "auditor": [
        "auditor:read",
    ],
}


def require_permission(permission: str):
    """Dependency factory — raises 403 if user lacks permission."""
    async def _check(user: User = Depends(get_current_user)) -> User:
        perms = set(ROLE_PERMISSIONS.get(user.role.value, []))
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required",
            )
        return user
    return _check
