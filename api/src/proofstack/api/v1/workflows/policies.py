"""Policy approval workflows API."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from proofstack.api.deps import get_store
from proofstack.core.auth import require_permission
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.policy_workflow import (
    PolicyApprovalCreate,
    PolicyApprovalDecision,
    PolicyApprovalHistoryEntry,
    PolicyApprovalRequest,
    PolicyApprovalRequestCreate,
)

router = APIRouter()


def _request_to_read(d: dict) -> PolicyApprovalRequest:
    return PolicyApprovalRequest(
        id=d["id"],
        policy_id=d["policy_id"],
        version_id=d["version_id"],
        title=d["title"],
        status=d.get("status", "pending"),
        submitted_at=d["submitted_at"],
        approved_at=d.get("approved_at"),
        rejected_at=d.get("rejected_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _decision_to_read(d: dict) -> PolicyApprovalDecision:
    return PolicyApprovalDecision(
        id=d["id"],
        request_id=d["request_id"],
        approver_email=d["approver_email"],
        decision=d["decision"],
        comment=d.get("comment"),
        decided_at=d["decided_at"],
        created_at=d["created_at"],
    )


@router.get("", response_model=list[PolicyApprovalRequest])
async def list_policy_approval_requests(
    status: str | None = Query(None, description="pending | approved | rejected"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    rows = await store.list_policy_approval_requests(status=status, skip=skip, limit=limit)
    return [_request_to_read(r) for r in rows]


@router.post("", response_model=PolicyApprovalRequest)
async def create_policy_approval_request(
    body: PolicyApprovalRequestCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    created = await store.create_policy_approval_request(body.model_dump())
    return _request_to_read(created)


@router.get("/{request_id}", response_model=PolicyApprovalRequest)
async def get_policy_approval_request(
    request_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    row = await store.get_policy_approval_request(request_id)
    if not row:
        raise HTTPException(404, detail="Policy approval request not found")
    return _request_to_read(row)


@router.post("/{request_id}/approve", response_model=PolicyApprovalDecision)
async def approve_policy(
    request_id: str,
    body: PolicyApprovalCreate | None = None,
    store: BackboardStore = Depends(get_store),
    current_user=Depends(require_permission("controls:write")),
):
    row = await store.get_policy_approval_request(request_id)
    if not row:
        raise HTTPException(404, detail="Policy approval request not found")
    if row.get("status") != "pending":
        raise HTTPException(400, detail="Request is not pending")
    now = datetime.now(timezone.utc).isoformat()
    decision_data = {
        "request_id": request_id,
        "approver_email": current_user.email,
        "decision": "approved",
        "comment": body.comment if body else None,
    }
    created = await store.create_policy_approval_decision(decision_data)
    await store.update_policy_approval_request(request_id, {"status": "approved", "approved_at": now})
    return _decision_to_read(created)


@router.post("/{request_id}/reject", response_model=PolicyApprovalDecision)
async def reject_policy(
    request_id: str,
    body: PolicyApprovalCreate | None = None,
    store: BackboardStore = Depends(get_store),
    current_user=Depends(require_permission("controls:write")),
):
    row = await store.get_policy_approval_request(request_id)
    if not row:
        raise HTTPException(404, detail="Policy approval request not found")
    if row.get("status") != "pending":
        raise HTTPException(400, detail="Request is not pending")
    now = datetime.now(timezone.utc).isoformat()
    decision_data = {
        "request_id": request_id,
        "approver_email": current_user.email,
        "decision": "rejected",
        "comment": body.comment if body else None,
    }
    created = await store.create_policy_approval_decision(decision_data)
    await store.update_policy_approval_request(request_id, {"status": "rejected", "rejected_at": now})
    return _decision_to_read(created)


@router.get("/{request_id}/history", response_model=list[PolicyApprovalHistoryEntry])
async def get_policy_approval_history(
    request_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    if not await store.get_policy_approval_request(request_id):
        raise HTTPException(404, detail="Policy approval request not found")
    rows = await store.list_policy_approval_decisions(request_id)
    return [
        PolicyApprovalHistoryEntry(
            request_id=r["request_id"],
            approver_email=r["approver_email"],
            decision=r["decision"],
            comment=r.get("comment"),
            decided_at=r["decided_at"],
        )
        for r in rows
    ]
