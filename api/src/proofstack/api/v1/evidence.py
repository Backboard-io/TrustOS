"""Evidence vault API."""

import hashlib
import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query

from proofstack.api.deps import get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.evidence import EvidenceArtifactRead, EvidenceArtifactUploadResponse
from proofstack.services.s3 import make_evidence_key, upload_evidence, generate_presigned_download_url

router = APIRouter()


@router.get("", response_model=list[EvidenceArtifactRead])
async def list_evidence(
    store: BackboardStore = Depends(get_store),
    control_id: str | None = Query(None),
    run_id: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    rows = await store.list_evidence(control_id=control_id, run_id=run_id, skip=skip, limit=limit)
    return [EvidenceArtifactRead(**r) for r in rows]


@router.post("/upload", response_model=EvidenceArtifactUploadResponse, status_code=201)
async def upload_evidence_artifact(
    file: UploadFile = File(...),
    control_id: str | None = Form(None),
    run_id: str | None = Form(None),
    store: BackboardStore = Depends(get_store),
):
    content = await file.read()
    checksum = hashlib.sha256(content).hexdigest()
    file_name = file.filename or "upload"
    content_type = file.content_type or "application/octet-stream"
    s3_key = make_evidence_key(file_name=file_name)

    upload_evidence(s3_key, io.BytesIO(content), content_type)

    row = await store.create_evidence({
        "run_id": run_id,
        "control_id": control_id,
        "file_name": file_name,
        "s3_key": s3_key,
        "content_type": content_type,
        "uploaded_by": None,
        "checksum": checksum,
    })
    return EvidenceArtifactUploadResponse(
        id=row["id"],
        file_name=row["file_name"],
        s3_key=row["s3_key"],
        content_type=row["content_type"],
        uploaded_at=row["uploaded_at"],
    )


@router.get("/{artifact_id}/download")
async def download_evidence_artifact(
    artifact_id: str,
    store: BackboardStore = Depends(get_store),
):
    row = await store.get_evidence(artifact_id)
    if not row:
        raise HTTPException(status_code=404, detail="Evidence artifact not found")
    url = generate_presigned_download_url(row["s3_key"])
    return {"download_url": url}
