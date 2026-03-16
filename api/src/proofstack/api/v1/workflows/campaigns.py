"""Access review campaigns API — campaigns and attestations."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from proofstack.api.deps import get_store
from proofstack.core.auth import require_permission
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.campaign import (
    AccessReviewCampaign,
    AttestationCreate,
    CampaignCreate,
    CampaignResult,
    CampaignUpdate,
    ReviewerAttestation,
)

router = APIRouter()


def _campaign_to_read(d: dict) -> AccessReviewCampaign:
    return AccessReviewCampaign(
        id=d["id"],
        name=d["name"],
        description=d.get("description"),
        recurrence=d.get("recurrence", "quarterly"),
        status=d.get("status", "draft"),
        due_at=d.get("due_at"),
        closed_at=d.get("closed_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _attestation_to_read(d: dict) -> ReviewerAttestation:
    return ReviewerAttestation(
        id=d["id"],
        campaign_id=d["campaign_id"],
        reviewer_email=d["reviewer_email"],
        subject_id=d["subject_id"],
        subject_type=d.get("subject_type", "user"),
        outcome=d["outcome"],
        comment=d.get("comment"),
        attested_at=d["attested_at"],
        created_at=d["created_at"],
    )


@router.get("", response_model=list[AccessReviewCampaign])
async def list_campaigns(
    status: str | None = Query(None, description="draft | active | closed"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    rows = await store.list_campaigns(status=status, skip=skip, limit=limit)
    return [_campaign_to_read(r) for r in rows]


@router.post("", response_model=AccessReviewCampaign)
async def create_campaign(
    body: CampaignCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    created = await store.create_campaign(body.model_dump())
    return _campaign_to_read(created)


@router.get("/{campaign_id}", response_model=AccessReviewCampaign)
async def get_campaign(
    campaign_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    row = await store.get_campaign(campaign_id)
    if not row:
        raise HTTPException(404, detail="Campaign not found")
    return _campaign_to_read(row)


@router.patch("/{campaign_id}", response_model=AccessReviewCampaign)
async def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    updated = await store.update_campaign(campaign_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(404, detail="Campaign not found")
    return _campaign_to_read(updated)


@router.get("/{campaign_id}/attestations", response_model=list[ReviewerAttestation])
async def list_attestations(
    campaign_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    if not await store.get_campaign(campaign_id):
        raise HTTPException(404, detail="Campaign not found")
    rows = await store.list_attestations(campaign_id)
    return [_attestation_to_read(r) for r in rows]


@router.post("/{campaign_id}/attest", response_model=ReviewerAttestation)
async def create_attestation(
    campaign_id: str,
    body: AttestationCreate,
    store: BackboardStore = Depends(get_store),
    current_user=Depends(require_permission("controls:write")),
):
    if not await store.get_campaign(campaign_id):
        raise HTTPException(404, detail="Campaign not found")
    data = body.model_dump() | {
        "campaign_id": campaign_id,
        "reviewer_email": current_user.email,
    }
    created = await store.create_attestation(data)
    return _attestation_to_read(created)


@router.post("/{campaign_id}/close", response_model=AccessReviewCampaign)
async def close_campaign(
    campaign_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    row = await store.get_campaign(campaign_id)
    if not row:
        raise HTTPException(404, detail="Campaign not found")
    if row.get("status") == "closed":
        return _campaign_to_read(row)
    now = datetime.now(timezone.utc).isoformat()
    updated = await store.update_campaign(campaign_id, {"status": "closed", "closed_at": now})
    return _campaign_to_read(updated)


@router.get("/{campaign_id}/result", response_model=CampaignResult)
async def get_campaign_result(
    campaign_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    row = await store.get_campaign(campaign_id)
    if not row:
        raise HTTPException(404, detail="Campaign not found")
    attestations = await store.list_attestations(campaign_id)
    approved = sum(1 for a in attestations if a.get("outcome") == "approved")
    revoked = sum(1 for a in attestations if a.get("outcome") == "revoked")
    no_change = sum(1 for a in attestations if a.get("outcome") == "no_change")
    return CampaignResult(
        campaign_id=campaign_id,
        total_subjects=len({(a.get("subject_id"), a.get("subject_type")) for a in attestations}),
        attested_count=len(attestations),
        approved_count=approved,
        revoked_count=revoked,
        no_change_count=no_change,
        overdue_count=0,
        closed_at=row.get("closed_at"),
    )
