"""Audit export bundle API."""

from fastapi import APIRouter, Depends, HTTPException

from proofstack.api.deps import get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.audit_export import AuditExportCreate, AuditExportBundleRead, AuditExportBundleWithUrl
from proofstack.services.s3 import generate_presigned_download_url, bucket_exists
from proofstack.services.audit_export import build_manifest, upload_manifest_to_s3

router = APIRouter()


@router.post("", response_model=AuditExportBundleWithUrl, status_code=201)
async def create_audit_export(
    body: AuditExportCreate,
    store: BackboardStore = Depends(get_store),
):
    manifest = await build_manifest(store, body.period_start, body.period_end)
    bundle_s3_key = f"audit-exports/{body.period_start.date()}_to_{body.period_end.date()}.json"
    if bucket_exists():
        upload_manifest_to_s3(manifest, bundle_s3_key)

    row = await store.create_audit_export({
        "period_start": body.period_start.isoformat(),
        "period_end": body.period_end.isoformat(),
        "manifest": manifest,
        "bundle_s3_key": bundle_s3_key,
    })
    url = generate_presigned_download_url(bundle_s3_key) if bucket_exists() else None
    return AuditExportBundleWithUrl(
        **AuditExportBundleRead(**row).model_dump(),
        download_url=url,
    )


@router.get("/{bundle_id}", response_model=AuditExportBundleWithUrl)
async def get_audit_export(
    bundle_id: str,
    store: BackboardStore = Depends(get_store),
):
    row = await store.get_audit_export(bundle_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit export bundle not found")
    url = generate_presigned_download_url(row["bundle_s3_key"])
    return AuditExportBundleWithUrl(
        **AuditExportBundleRead(**row).model_dump(),
        download_url=url,
    )
