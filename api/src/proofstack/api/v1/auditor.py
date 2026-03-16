"""Auditor workspace and PBC (Provided By Client) management API."""

from __future__ import annotations

import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi import status

from proofstack.api.deps import get_store
from proofstack.core.auth import ROLE_PERMISSIONS, get_current_user, require_permission
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.auditor import (
    AuditorWorkspace,
    AuditorWorkspaceCreate,
    AuditorWorkspaceUpdate,
    PBCFulfillCreate,
    PBCItem,
    PBCItemCreate,
    PBCItemUpdate,
)
from proofstack.schemas.user import User, UserRole
from proofstack.services.s3 import generate_presigned_download_url, make_evidence_key, upload_evidence

router = APIRouter()


def _workspace_to_read(d: dict) -> AuditorWorkspace:
    return AuditorWorkspace(
        id=d["id"],
        name=d["name"],
        description=d.get("description"),
        auditor_emails=d.get("auditor_emails", []),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _pbc_item_to_read(d: dict) -> PBCItem:
    return PBCItem(
        id=d["id"],
        request_id=d.get("request_id", ""),
        workspace_id=d["workspace_id"],
        title=d["title"],
        description=d.get("description"),
        status=d.get("status", "open"),
        s3_key=d.get("s3_key"),
        fulfilled_at=d.get("fulfilled_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


# -------------------------------------------------------------------------
# Admin: workspace and PBC CRUD (requires auditor:write, i.e. admin)
# -------------------------------------------------------------------------

@router.post("/workspaces", response_model=AuditorWorkspace)
async def create_workspace(
    body: AuditorWorkspaceCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("auditor:write")),
):
    created = await store.create_auditor_workspace(body.model_dump())
    return _workspace_to_read(created)


@router.get("/workspaces", response_model=list[AuditorWorkspace])
async def list_workspaces(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []) and "auditor:write" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor access required")
    if current_user.role == UserRole.AUDITOR:
        rows = await store.list_auditor_workspaces(skip=skip, limit=limit)
        rows = [r for r in rows if current_user.email in r.get("auditor_emails", [])]
    else:
        rows = await store.list_auditor_workspaces(skip=skip, limit=limit)
    return [_workspace_to_read(r) for r in rows]


@router.get("/workspaces/{workspace_id}", response_model=AuditorWorkspace)
async def get_workspace(
    workspace_id: str,
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []) and "auditor:write" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor access required")
    if current_user.role == UserRole.AUDITOR:
        row = await store.get_auditor_workspace(workspace_id)
        if not row or current_user.email not in row.get("auditor_emails", []):
            raise HTTPException(404, detail="Workspace not found")
    else:
        row = await store.get_auditor_workspace(workspace_id)
    if not row:
        raise HTTPException(404, detail="Workspace not found")
    return _workspace_to_read(row)


@router.patch("/workspaces/{workspace_id}", response_model=AuditorWorkspace)
async def update_workspace(
    workspace_id: str,
    body: AuditorWorkspaceUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("auditor:write")),
):
    updated = await store.update_auditor_workspace(workspace_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(404, detail="Workspace not found")
    return _workspace_to_read(updated)


@router.post("/workspaces/{workspace_id}/pbc", response_model=PBCItem)
async def create_pbc_item(
    workspace_id: str,
    body: PBCItemCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("auditor:write")),
):
    if not await store.get_auditor_workspace(workspace_id):
        raise HTTPException(404, detail="Workspace not found")
    data = body.model_dump() | {"workspace_id": workspace_id, "request_id": workspace_id}
    created = await store.create_pbc_item(data)
    return _pbc_item_to_read(created)


@router.get("/workspaces/{workspace_id}/pbc", response_model=list[PBCItem])
async def list_pbc_items(
    workspace_id: str,
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []) and "auditor:write" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor access required")
    if current_user.role == UserRole.AUDITOR:
        ws = await store.get_auditor_workspace(workspace_id)
        if not ws or current_user.email not in ws.get("auditor_emails", []):
            raise HTTPException(404, detail="Workspace not found")
    else:
        if not await store.get_auditor_workspace(workspace_id):
            raise HTTPException(404, detail="Workspace not found")
    rows = await store.list_pbc_items(workspace_id)
    return [_pbc_item_to_read(r) for r in rows]


@router.patch("/workspaces/{workspace_id}/pbc/{item_id}", response_model=PBCItem)
async def update_pbc_item(
    workspace_id: str,
    item_id: str,
    body: PBCItemUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("auditor:write")),
):
    item = await store.get_pbc_item(item_id)
    if not item or item.get("workspace_id") != workspace_id:
        raise HTTPException(404, detail="PBC item not found")
    updated = await store.update_pbc_item(item_id, body.model_dump(exclude_unset=True))
    return _pbc_item_to_read(updated)


@router.post("/workspaces/{workspace_id}/pbc/{item_id}/fulfill", response_model=PBCItem)
async def fulfill_pbc_item(
    workspace_id: str,
    item_id: str,
    body: PBCFulfillCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("auditor:write")),
):
    item = await store.get_pbc_item(item_id)
    if not item or item.get("workspace_id") != workspace_id:
        raise HTTPException(404, detail="PBC item not found")
    now = datetime.now(timezone.utc).isoformat()
    updated = await store.update_pbc_item(
        item_id,
        {"status": "fulfilled", "s3_key": body.s3_key, "fulfilled_at": now},
    )
    return _pbc_item_to_read(updated)


# -------------------------------------------------------------------------
# Read-only portal (auditor role can access)
# -------------------------------------------------------------------------

@router.get("/portal/workspaces", response_model=list[AuditorWorkspace])
async def portal_list_workspaces(
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor:read required")
    rows = await store.list_auditor_workspaces(limit=100)
    if current_user.role == UserRole.AUDITOR:
        rows = [r for r in rows if current_user.email in r.get("auditor_emails", [])]
    return [_workspace_to_read(r) for r in rows]


@router.get("/portal/workspaces/{workspace_id}", response_model=AuditorWorkspace)
async def portal_get_workspace(
    workspace_id: str,
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor:read required")
    row = await store.get_auditor_workspace(workspace_id)
    if not row:
        raise HTTPException(404, detail="Workspace not found")
    if current_user.role == UserRole.AUDITOR and current_user.email not in row.get("auditor_emails", []):
        raise HTTPException(404, detail="Workspace not found")
    return _workspace_to_read(row)


@router.get("/portal/workspaces/{workspace_id}/pbc", response_model=list[PBCItem])
async def portal_list_pbc(
    workspace_id: str,
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor:read required")
    ws = await store.get_auditor_workspace(workspace_id)
    if not ws:
        raise HTTPException(404, detail="Workspace not found")
    if current_user.role == UserRole.AUDITOR and current_user.email not in ws.get("auditor_emails", []):
        raise HTTPException(404, detail="Workspace not found")
    rows = await store.list_pbc_items(workspace_id)
    return [_pbc_item_to_read(r) for r in rows]


@router.post("/portal/workspaces/{workspace_id}/pbc/{item_id}/fulfill", response_model=PBCItem)
async def portal_fulfill_pbc_item(
    workspace_id: str,
    item_id: str,
    file: UploadFile = File(...),
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor:read required")
    ws = await store.get_auditor_workspace(workspace_id)
    if not ws:
        raise HTTPException(404, detail="Workspace not found")
    if current_user.role == UserRole.AUDITOR and current_user.email not in ws.get("auditor_emails", []):
        raise HTTPException(404, detail="Workspace not found")
    item = await store.get_pbc_item(item_id)
    if not item or item.get("workspace_id") != workspace_id:
        raise HTTPException(404, detail="PBC item not found")
    content = await file.read()
    s3_key = make_evidence_key(prefix="pbc", file_name=file.filename or "upload")
    upload_evidence(s3_key, io.BytesIO(content), file.content_type or "application/octet-stream")
    now = datetime.now(timezone.utc).isoformat()
    updated = await store.update_pbc_item(
        item_id,
        {"status": "in_review", "s3_key": s3_key, "fulfilled_at": now},
    )
    return _pbc_item_to_read(updated)


@router.get("/portal/workspaces/{workspace_id}/pbc/{item_id}/download")
async def portal_download_pbc_evidence(
    workspace_id: str,
    item_id: str,
    store: BackboardStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
):
    if "auditor:read" not in ROLE_PERMISSIONS.get(current_user.role.value, []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="auditor:read required")
    ws = await store.get_auditor_workspace(workspace_id)
    if not ws:
        raise HTTPException(404, detail="Workspace not found")
    if current_user.role == UserRole.AUDITOR and current_user.email not in ws.get("auditor_emails", []):
        raise HTTPException(404, detail="Workspace not found")
    item = await store.get_pbc_item(item_id)
    if not item or item.get("workspace_id") != workspace_id:
        raise HTTPException(404, detail="PBC item not found")
    if not item.get("s3_key"):
        raise HTTPException(404, detail="No evidence uploaded for this item")
    url = generate_presigned_download_url(item["s3_key"])
    return {"download_url": url}
