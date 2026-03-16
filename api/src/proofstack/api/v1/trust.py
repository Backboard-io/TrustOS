"""Trust center API — public documents, NDA gate, questionnaire library."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from proofstack.api.deps import get_store, get_store_by_app_id
from proofstack.core.auth import require_permission
from proofstack.core.backboard import BackboardStore, _new_id
from proofstack.schemas.trust import (
    NDAGrant,
    NDASignCreate,
    QuestionnaireLibraryCreate,
    QuestionnaireLibraryEntry,
    QuestionnaireLibraryUpdate,
    SecurityQuestionTemplate,
    TrustDocument,
    TrustDocumentCreate,
    TrustDocumentUpdate,
)

router = APIRouter()

NDA_TOKEN_EXPIRE_DAYS = 30


def _doc_to_read(d: dict) -> TrustDocument:
    return TrustDocument(
        id=d["id"],
        title=d["title"],
        description=d.get("description"),
        s3_key=d["s3_key"],
        is_public=d.get("is_public", True),
        requires_nda=d.get("requires_nda", False),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _library_entry_to_read(d: dict) -> QuestionnaireLibraryEntry:
    questions = [
        SecurityQuestionTemplate(
            id=q.get("id", ""),
            question=q.get("question", ""),
            category=q.get("category"),
            order=q.get("order", 0),
        )
        for q in d.get("questions", [])
    ]
    return QuestionnaireLibraryEntry(
        id=d["id"],
        title=d["title"],
        description=d.get("description"),
        questions=questions,
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


# -------------------------------------------------------------------------
# Public routes (no auth) — require app_id in path when registry enabled
# -------------------------------------------------------------------------

@router.get("/o/{app_id}/documents", response_model=list[TrustDocument])
async def public_list_documents(
    app_id: str,
    store: BackboardStore = Depends(get_store_by_app_id),
):
    rows = await store.list_trust_documents(is_public=True)
    return [_doc_to_read(r) for r in rows]


@router.post("/o/{app_id}/nda/sign", response_model=NDAGrant)
async def public_nda_sign(
    app_id: str,
    body: NDASignCreate,
    store: BackboardStore = Depends(get_store_by_app_id),
):
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=NDA_TOKEN_EXPIRE_DAYS)
    access_token = _new_id()
    record = await store.create_nda_record({
        "email": body.email,
        "name": body.name,
        "signed_at": now.isoformat(),
        "access_token": access_token,
        "token_expires_at": expires.isoformat(),
    })
    token_expires_at = record.get("token_expires_at", expires.isoformat())
    docs = await store.list_trust_documents(requires_nda=True)
    return NDAGrant(
        access_token=access_token,
        token_expires_at=token_expires_at,
        documents=[_doc_to_read(d) for d in docs],
    )


@router.get("/o/{app_id}/nda/{token}/documents", response_model=list[TrustDocument])
async def public_nda_gated_documents(
    app_id: str,
    token: str,
    store: BackboardStore = Depends(get_store_by_app_id),
):
    record = await store.get_nda_record_by_token(token)
    if not record:
        raise HTTPException(404, detail="NDA not found or expired")
    expires = record.get("token_expires_at", "")
    if expires and expires < datetime.now(timezone.utc).isoformat():
        raise HTTPException(403, detail="NDA access expired")
    rows = await store.list_trust_documents(requires_nda=True)
    return [_doc_to_read(r) for r in rows]


# -------------------------------------------------------------------------
# Admin (authenticated, app-scoped via X-App-ID)
# -------------------------------------------------------------------------

@router.get("/documents", response_model=list[TrustDocument])
async def list_documents(
    is_public: bool | None = Query(None),
    requires_nda: bool | None = Query(None),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    rows = await store.list_trust_documents(is_public=is_public, requires_nda=requires_nda)
    return [_doc_to_read(r) for r in rows]


@router.post("/documents", response_model=TrustDocument)
async def create_document(
    body: TrustDocumentCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    created = await store.create_trust_document(body.model_dump())
    return _doc_to_read(created)


@router.patch("/documents/{doc_id}", response_model=TrustDocument)
async def update_document(
    doc_id: str,
    body: TrustDocumentUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    updated = await store.update_trust_document(doc_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(404, detail="Document not found")
    return _doc_to_read(updated)


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    ok = await store.delete_trust_document(doc_id)
    if not ok:
        raise HTTPException(404, detail="Document not found")
    return None


@router.get("/questionnaire-library", response_model=list[QuestionnaireLibraryEntry])
async def list_questionnaire_library(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    rows = await store.list_questionnaire_library(skip=skip, limit=limit)
    return [_library_entry_to_read(r) for r in rows]


@router.post("/questionnaire-library", response_model=QuestionnaireLibraryEntry)
async def create_questionnaire_library(
    body: QuestionnaireLibraryCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    created = await store.create_questionnaire_library_entry(body.model_dump())
    return _library_entry_to_read(created)


@router.patch("/questionnaire-library/{entry_id}", response_model=QuestionnaireLibraryEntry)
async def update_questionnaire_library(
    entry_id: str,
    body: QuestionnaireLibraryUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    updated = await store.update_questionnaire_library_entry(entry_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(404, detail="Questionnaire library entry not found")
    return _library_entry_to_read(updated)
