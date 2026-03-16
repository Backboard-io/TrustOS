"""HIPAA Security Rule readiness API — Phase 2."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form

from proofstack.api.deps import get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.hipaa import (
    PHIAssetCreate,
    PHIAssetUpdate,
    PHIAssetRead,
    BAAVendorCreate,
    BAAVendorUpdate,
    BAAVendorRead,
    TrainingRecordCreate,
    TrainingRecordRead,
    RiskAssessmentCreate,
    RiskAssessmentUpdate,
    RiskAssessmentRead,
    IncidentCreate,
    IncidentUpdate,
    IncidentRead,
    ContingencyEvidenceCreate,
    ContingencyEvidenceUpdate,
    ContingencyEvidenceRead,
    AccessReviewCreate,
    AccessReviewRead,
    PolicyAcknowledgementCreate,
    PolicyAcknowledgementRead,
    HIPAAAuditLogRead,
    HIPAADashboardSummary,
    HIPAAExportCreate,
    HIPAAExportRead,
    MissingEvidenceItem,
)
from proofstack.schemas.control import ControlCatalogRead
from proofstack.services import audit_export as audit_export_svc

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Audit log helper
# ─────────────────────────────────────────────────────────────────────────────

async def _audit(
    store: BackboardStore,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    actor_email: str = "system",
    outcome: str = "success",
) -> None:
    await store.append_hipaa_audit_log({
        "actor_email": actor_email,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "outcome": outcome,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Controls
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/controls", response_model=list[ControlCatalogRead])
async def list_hipaa_controls(
    safeguard_category: str | None = Query(None, description="administrative | physical | technical"),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_controls(framework="HIPAA-Security-Rule", limit=100)
    if safeguard_category:
        filtered = []
        for r in rows:
            raw = r.get("raw_oscal_jsonb") or {}
            for prop in raw.get("props", []):
                if prop.get("name") == "safeguard_category" and prop.get("value") == safeguard_category:
                    filtered.append(r)
                    break
        rows = filtered
    return [ControlCatalogRead(**r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=HIPAADashboardSummary)
async def hipaa_dashboard(store: BackboardStore = Depends(get_store)):
    summary = await store.get_hipaa_dashboard_summary()
    return HIPAADashboardSummary(
        safeguard_status=summary["safeguard_status"],
        missing_evidence_controls=[
            MissingEvidenceItem(**m) for m in summary["missing_evidence_controls"]
        ],
        overdue_training_count=summary["overdue_training_count"],
        expiring_baa_count=summary["expiring_baa_count"],
        open_risk_count=summary["open_risk_count"],
        open_incident_count=summary["open_incident_count"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# PHI Assets
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/phi-assets", response_model=list[PHIAssetRead])
async def list_phi_assets(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_phi_assets(skip=skip, limit=limit)
    return [PHIAssetRead(**r) for r in rows]


@router.post("/phi-assets", response_model=PHIAssetRead, status_code=201)
async def create_phi_asset(
    body: PHIAssetCreate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.create_phi_asset(body.model_dump())
    await _audit(store, "create", "phi_asset", row["id"])
    return PHIAssetRead(**row)


@router.put("/phi-assets/{asset_id}", response_model=PHIAssetRead)
async def update_phi_asset(
    asset_id: UUID,
    body: PHIAssetUpdate,
    store: BackboardStore = Depends(get_store),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    row = await store.update_phi_asset(str(asset_id), updates)
    if not row:
        raise HTTPException(status_code=404, detail="PHI asset not found")
    await _audit(store, "update", "phi_asset", str(asset_id))
    return PHIAssetRead(**row)


@router.delete("/phi-assets/{asset_id}", status_code=204)
async def delete_phi_asset(
    asset_id: UUID,
    store: BackboardStore = Depends(get_store),
):
    ok = await store.delete_phi_asset(str(asset_id))
    if not ok:
        raise HTTPException(status_code=404, detail="PHI asset not found")
    await _audit(store, "delete", "phi_asset", str(asset_id))


# ─────────────────────────────────────────────────────────────────────────────
# BAA Vendors
# ─────────────────────────────────────────────────────────────────────────────

def _baa_days_until_expiry(row: dict) -> int | None:
    expiry = row.get("baa_expiry_date")
    if not expiry:
        return None
    try:
        exp_date = datetime.fromisoformat(expiry).date()
        delta = (exp_date - datetime.now(timezone.utc).date()).days
        return delta
    except ValueError:
        return None


@router.get("/baa", response_model=list[BAAVendorRead])
async def list_baa_vendors(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_baa_vendors(skip=skip, limit=limit)
    result = []
    for r in rows:
        r["days_until_expiry"] = _baa_days_until_expiry(r)
        result.append(BAAVendorRead(**r))
    return result


@router.post("/baa", response_model=BAAVendorRead, status_code=201)
async def create_baa_vendor(
    body: BAAVendorCreate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.create_baa_vendor(body.model_dump())
    row["days_until_expiry"] = _baa_days_until_expiry(row)
    await _audit(store, "create", "baa_vendor", row["id"])
    return BAAVendorRead(**row)


@router.put("/baa/{vendor_id}", response_model=BAAVendorRead)
async def update_baa_vendor(
    vendor_id: UUID,
    body: BAAVendorUpdate,
    store: BackboardStore = Depends(get_store),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    row = await store.update_baa_vendor(str(vendor_id), updates)
    if not row:
        raise HTTPException(status_code=404, detail="BAA vendor not found")
    row["days_until_expiry"] = _baa_days_until_expiry(row)
    await _audit(store, "update", "baa_vendor", str(vendor_id))
    return BAAVendorRead(**row)


@router.post("/baa/{vendor_id}/upload", response_model=BAAVendorRead)
async def upload_baa_document(
    vendor_id: UUID,
    file: UploadFile = File(...),
    store: BackboardStore = Depends(get_store),
):
    """Upload a signed BAA document for a vendor and store it in S3."""
    from proofstack.services.s3 import _client
    from proofstack.core.config import settings

    contents = await file.read()
    s3_key = f"baa-documents/{vendor_id}/{file.filename}"
    s3 = _client()
    s3.put_object(
        Bucket=settings.s3_bucket,
        Key=s3_key,
        Body=contents,
        ContentType=file.content_type or "application/octet-stream",
    )
    row = await store.update_baa_vendor(str(vendor_id), {"s3_key": s3_key})
    if not row:
        raise HTTPException(status_code=404, detail="BAA vendor not found")
    row["days_until_expiry"] = _baa_days_until_expiry(row)
    await _audit(store, "upload_document", "baa_vendor", str(vendor_id))
    return BAAVendorRead(**row)


# ─────────────────────────────────────────────────────────────────────────────
# Training Records
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/training", response_model=list[TrainingRecordRead])
async def list_training_records(
    user_email: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_training_records(user_email=user_email, status=status, skip=skip, limit=limit)
    return [TrainingRecordRead(**r) for r in rows]


@router.get("/training/overdue", response_model=list[TrainingRecordRead])
async def list_overdue_training(store: BackboardStore = Depends(get_store)):
    today = datetime.now(timezone.utc).date().isoformat()
    rows = await store.list_training_records(limit=10000)
    overdue = [
        r for r in rows
        if r.get("status") != "completed" and r.get("due_at", "9999") < today
    ]
    return [TrainingRecordRead(**r) for r in overdue]


@router.post("/training", response_model=TrainingRecordRead, status_code=201)
async def create_training_record(
    body: TrainingRecordCreate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.create_training_record(body.model_dump())
    await _audit(store, "create", "training_record", row["id"])
    return TrainingRecordRead(**row)


# ─────────────────────────────────────────────────────────────────────────────
# Risk Assessments
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/risk-assessments", response_model=list[RiskAssessmentRead])
async def list_risk_assessments(
    status: str | None = Query(None),
    phi_asset_id: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_risk_assessments(status=status, phi_asset_id=phi_asset_id, skip=skip, limit=limit)
    return [RiskAssessmentRead(**r) for r in rows]


@router.post("/risk-assessments", response_model=RiskAssessmentRead, status_code=201)
async def create_risk_assessment(
    body: RiskAssessmentCreate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.create_risk_assessment(body.model_dump())
    await _audit(store, "create", "risk_assessment", row["id"])
    return RiskAssessmentRead(**row)


@router.put("/risk-assessments/{risk_id}", response_model=RiskAssessmentRead)
async def update_risk_assessment(
    risk_id: UUID,
    body: RiskAssessmentUpdate,
    store: BackboardStore = Depends(get_store),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    row = await store.update_risk_assessment(str(risk_id), updates)
    if not row:
        raise HTTPException(status_code=404, detail="Risk assessment not found")
    await _audit(store, "update", "risk_assessment", str(risk_id))
    return RiskAssessmentRead(**row)


# ─────────────────────────────────────────────────────────────────────────────
# Incidents
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/incidents", response_model=list[IncidentRead])
async def list_incidents(
    status: str | None = Query(None),
    severity: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_incidents(status=status, severity=severity, skip=skip, limit=limit)
    return [IncidentRead(**r) for r in rows]


@router.post("/incidents", response_model=IncidentRead, status_code=201)
async def create_incident(
    body: IncidentCreate,
    store: BackboardStore = Depends(get_store),
):
    data = body.model_dump()
    for k in ("discovered_at", "reported_at", "resolved_at"):
        if data.get(k) and hasattr(data[k], "isoformat"):
            data[k] = data[k].isoformat()
    row = await store.create_incident(data)
    await _audit(store, "create", "incident", row["id"])
    return IncidentRead(**row)


@router.put("/incidents/{incident_id}", response_model=IncidentRead)
async def update_incident(
    incident_id: UUID,
    body: IncidentUpdate,
    store: BackboardStore = Depends(get_store),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    for k in ("reported_at", "resolved_at"):
        if updates.get(k) and hasattr(updates[k], "isoformat"):
            updates[k] = updates[k].isoformat()
    row = await store.update_incident(str(incident_id), updates)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    await _audit(store, "update", "incident", str(incident_id))
    return IncidentRead(**row)


# ─────────────────────────────────────────────────────────────────────────────
# Contingency Evidence
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/contingency", response_model=list[ContingencyEvidenceRead])
async def list_contingency_evidence(
    plan_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_contingency_evidence(plan_type=plan_type, skip=skip, limit=limit)
    return [ContingencyEvidenceRead(**r) for r in rows]


@router.post("/contingency", response_model=ContingencyEvidenceRead, status_code=201)
async def create_contingency_evidence(
    body: ContingencyEvidenceCreate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.create_contingency_evidence(body.model_dump())
    await _audit(store, "create", "contingency_evidence", row["id"])
    return ContingencyEvidenceRead(**row)


@router.put("/contingency/{evidence_id}", response_model=ContingencyEvidenceRead)
async def update_contingency_evidence(
    evidence_id: UUID,
    body: ContingencyEvidenceUpdate,
    store: BackboardStore = Depends(get_store),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    row = await store.update_contingency_evidence(str(evidence_id), updates)
    if not row:
        raise HTTPException(status_code=404, detail="Contingency evidence not found")
    await _audit(store, "update", "contingency_evidence", str(evidence_id))
    return ContingencyEvidenceRead(**row)


@router.post("/contingency/{evidence_id}/upload", response_model=ContingencyEvidenceRead)
async def upload_contingency_file(
    evidence_id: UUID,
    file: UploadFile = File(...),
    store: BackboardStore = Depends(get_store),
):
    from proofstack.services.s3 import _client
    from proofstack.core.config import settings

    contents = await file.read()
    s3_key = f"contingency/{evidence_id}/{file.filename}"
    s3 = _client()
    s3.put_object(
        Bucket=settings.s3_bucket,
        Key=s3_key,
        Body=contents,
        ContentType=file.content_type or "application/octet-stream",
    )
    row = await store.update_contingency_evidence(str(evidence_id), {"s3_key": s3_key})
    if not row:
        raise HTTPException(status_code=404, detail="Contingency evidence not found")
    await _audit(store, "upload_document", "contingency_evidence", str(evidence_id))
    return ContingencyEvidenceRead(**row)


# ─────────────────────────────────────────────────────────────────────────────
# Access Reviews
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/access-reviews", response_model=list[AccessReviewRead])
async def list_access_reviews(
    system_name: str | None = Query(None),
    decision: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_access_reviews(system_name=system_name, decision=decision, skip=skip, limit=limit)
    return [AccessReviewRead(**r) for r in rows]


@router.post("/access-reviews", response_model=AccessReviewRead, status_code=201)
async def create_access_review(
    body: AccessReviewCreate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.create_access_review(body.model_dump())
    await _audit(store, "create", "access_review", row["id"])
    return AccessReviewRead(**row)


# ─────────────────────────────────────────────────────────────────────────────
# Policy Acknowledgements
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/policies", response_model=list[PolicyAcknowledgementRead])
async def list_policy_acknowledgements(
    policy_name: str | None = Query(None),
    user_email: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_policy_acknowledgements(policy_name=policy_name, user_email=user_email, skip=skip, limit=limit)
    return [PolicyAcknowledgementRead(**r) for r in rows]


@router.post("/policies", response_model=PolicyAcknowledgementRead, status_code=201)
async def create_policy_acknowledgement(
    body: PolicyAcknowledgementCreate,
    store: BackboardStore = Depends(get_store),
):
    data = body.model_dump()
    if data.get("acknowledged_at") and hasattr(data["acknowledged_at"], "isoformat"):
        data["acknowledged_at"] = data["acknowledged_at"].isoformat()
    row = await store.create_policy_acknowledgement(data)
    await _audit(store, "create", "policy_acknowledgement", row["id"])
    return PolicyAcknowledgementRead(**row)


# ─────────────────────────────────────────────────────────────────────────────
# HIPAA Audit Log
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/audit-log", response_model=list[HIPAAAuditLogRead])
async def list_hipaa_audit_log(
    resource_type: str | None = Query(None),
    actor_email: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_hipaa_audit_log(
        resource_type=resource_type,
        actor_email=actor_email,
        skip=skip,
        limit=limit,
    )
    return [HIPAAAuditLogRead(**r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# HIPAA Audit Export
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/audit-export", response_model=HIPAAExportRead, status_code=201)
async def create_hipaa_audit_export(
    body: HIPAAExportCreate,
    store: BackboardStore = Depends(get_store),
):
    from proofstack.services.audit_export import build_hipaa_manifest, upload_manifest_to_s3
    from proofstack.services.s3 import generate_presigned_download_url
    import uuid as _uuid

    bundle_id = str(_uuid.uuid4())
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    period_slug = f"{body.period_start.date()}_{body.period_end.date()}"
    s3_key = f"audit-exports/hipaa/{period_slug}_{ts}_{bundle_id[:8]}.json"

    manifest = await build_hipaa_manifest(store, body.period_start, body.period_end)
    upload_manifest_to_s3(manifest, s3_key)

    record = await store.create_audit_export({
        "id": bundle_id,
        "period_start": body.period_start.isoformat(),
        "period_end": body.period_end.isoformat(),
        "manifest": manifest,
        "bundle_s3_key": s3_key,
        "framework": "HIPAA-Security-Rule",
    })
    await _audit(store, "export", "hipaa_audit_export", bundle_id)

    download_url = generate_presigned_download_url(s3_key)
    return HIPAAExportRead(
        id=record["id"],
        period_start=body.period_start,
        period_end=body.period_end,
        bundle_s3_key=s3_key,
        created_at=record["created_at"],
        download_url=download_url,
    )
