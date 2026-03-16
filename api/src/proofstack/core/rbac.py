"""RBAC: re-exports from core.auth for backward compat with existing route files."""

# All auth/permission logic has moved to core.auth.
# This module is kept so existing imports don't break during migration.
from proofstack.core.auth import (  # noqa: F401
    ROLE_PERMISSIONS,
    get_current_user,
    require_permission,
)

# Alias used by the old /me route
get_current_user_optional = get_current_user
