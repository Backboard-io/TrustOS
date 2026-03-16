"""Vendor management API — profiles, tiering, questionnaires, document expiry."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from proofstack.api.deps import get_store
from proofstack.core.auth import require_permission
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.vendor import (
    DocumentExpiryAlert,
    QuestionnaireResponse,
    QuestionnaireResponseCreate,
    QuestionnaireSection,
    VendorDocument,
    VendorDocumentCreate,
    VendorProfile,
    VendorProfileCreate,
    VendorProfileUpdate,
    VendorQuestionnaire,
    VendorQuestionnaireCreate,
)

router = APIRouter()


def _vendor_to_read(d: dict) -> VendorProfile:
    return VendorProfile(
        id=d["id"],
        name=d["name"],
        contact_email=d.get("contact_email"),
        tier=d.get("tier", "medium"),
        description=d.get("description"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _questionnaire_to_read(d: dict) -> VendorQuestionnaire:
    sections = [
        QuestionnaireSection(id=s.get("id", ""), title=s["title"], questions=s.get("questions", []), order=s.get("order", 0))
        for s in d.get("sections", [])
    ]
    return VendorQuestionnaire(
        id=d["id"],
        vendor_id=d["vendor_id"],
        title=d["title"],
        sections=sections,
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _document_to_read(d: dict) -> VendorDocument:
    return VendorDocument(
        id=d["id"],
        vendor_id=d["vendor_id"],
        name=d["name"],
        doc_type=d["doc_type"],
        s3_key=d["s3_key"],
        expiry_date=d.get("expiry_date"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


@router.get("", response_model=list[VendorProfile])
async def list_vendors(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    rows = await store.list_vendor_profiles(skip=skip, limit=limit)
    return [_vendor_to_read(r) for r in rows]


@router.post("", response_model=VendorProfile)
async def create_vendor(
    body: VendorProfileCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    created = await store.create_vendor_profile(body.model_dump())
    return _vendor_to_read(created)


@router.get("/expiring", response_model=list[DocumentExpiryAlert])
async def list_expiring_documents(
    within_days: int = Query(90, ge=1, le=365),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    rows = await store.list_expiring_vendor_documents(within_days=within_days)
    alerts = []
    for r in rows:
        vendor = await store.get_vendor_profile(r["vendor_id"])
        alerts.append(
            DocumentExpiryAlert(
                document_id=r["id"],
                vendor_id=r["vendor_id"],
                vendor_name=vendor["name"] if vendor else "",
                name=r["name"],
                doc_type=r["doc_type"],
                expiry_date=r["expiry_date"],
                days_until_expiry=r.get("days_until_expiry", 0),
            )
        )
    return alerts


@router.get("/{vendor_id}", response_model=VendorProfile)
async def get_vendor(
    vendor_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    row = await store.get_vendor_profile(vendor_id)
    if not row:
        raise HTTPException(404, detail="Vendor not found")
    return _vendor_to_read(row)


@router.patch("/{vendor_id}", response_model=VendorProfile)
async def update_vendor(
    vendor_id: str,
    body: VendorProfileUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    updated = await store.update_vendor_profile(vendor_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(404, detail="Vendor not found")
    return _vendor_to_read(updated)


class VendorTierUpdate(BaseModel):
    tier: Literal["critical", "high", "medium", "low"]


@router.post("/{vendor_id}/tier")
async def set_vendor_tier(
    vendor_id: str,
    body: VendorTierUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    tier = body.tier
    updated = await store.update_vendor_profile(vendor_id, {"tier": tier})
    if not updated:
        raise HTTPException(404, detail="Vendor not found")
    return {"vendor_id": vendor_id, "tier": body.tier}


@router.post("/{vendor_id}/questionnaire", response_model=VendorQuestionnaire)
async def create_questionnaire(
    vendor_id: str,
    body: VendorQuestionnaireCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    if not await store.get_vendor_profile(vendor_id):
        raise HTTPException(404, detail="Vendor not found")
    data = {"vendor_id": vendor_id, "title": body.title, "sections": body.sections}
    created = await store.create_vendor_questionnaire(data)
    return _questionnaire_to_read(created)


@router.get("/{vendor_id}/questionnaire", response_model=list[VendorQuestionnaire])
async def list_questionnaires(
    vendor_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    if not await store.get_vendor_profile(vendor_id):
        raise HTTPException(404, detail="Vendor not found")
    rows = await store.list_vendor_questionnaires(vendor_id)
    return [_questionnaire_to_read(r) for r in rows]


@router.post("/{vendor_id}/respond", response_model=QuestionnaireResponse)
async def submit_questionnaire_response(
    vendor_id: str,
    body: QuestionnaireResponseCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    if not await store.get_vendor_profile(vendor_id):
        raise HTTPException(404, detail="Vendor not found")
    data = body.model_dump() | {"vendor_id": vendor_id}
    created = await store.create_questionnaire_response(data)
    return QuestionnaireResponse(
        id=created["id"],
        questionnaire_id=created["questionnaire_id"],
        vendor_id=created["vendor_id"],
        answers=created.get("answers", {}),
        submitted_at=created["submitted_at"],
        created_at=created["created_at"],
        updated_at=created["updated_at"],
    )


@router.get("/{vendor_id}/documents", response_model=list[VendorDocument])
async def list_vendor_documents(
    vendor_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    if not await store.get_vendor_profile(vendor_id):
        raise HTTPException(404, detail="Vendor not found")
    rows = await store.list_vendor_documents(vendor_id)
    return [_document_to_read(r) for r in rows]


@router.post("/{vendor_id}/documents", response_model=VendorDocument)
async def create_vendor_document(
    vendor_id: str,
    body: VendorDocumentCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    if not await store.get_vendor_profile(vendor_id):
        raise HTTPException(404, detail="Vendor not found")
    data = body.model_dump() | {"vendor_id": vendor_id}
    created = await store.create_vendor_document(data)
    return _document_to_read(created)
