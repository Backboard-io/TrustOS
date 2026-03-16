"""Audit export: build manifest and upload bundle to S3."""

from __future__ import annotations

import io
import json
from datetime import datetime

from proofstack.core.backboard import BackboardStore
from proofstack.services.s3 import _client
from proofstack.core.config import settings


async def build_manifest(
    store: BackboardStore,
    period_start: datetime,
    period_end: datetime,
) -> dict:
    """Build manifest: controls with result summary and artifact refs."""
    runs = await store.list_runs(status="completed", limit=1000)
    start_str = period_start.isoformat()
    end_str = period_end.isoformat()
    run_ids = {r["id"] for r in runs if start_str <= r.get("started_at", "") <= end_str}

    controls_summary: dict[str, dict] = {}

    for run_id in run_ids:
        results = await store.list_results_for_run(run_id)
        for r in results:
            cid = r.get("control_id", "")
            if cid not in controls_summary:
                controls_summary[cid] = {"pass": 0, "fail": 0, "not_applicable": 0, "error": 0, "artifacts": []}
            result_val = r.get("result", "error")
            if result_val in controls_summary[cid]:
                controls_summary[cid][result_val] += 1

    artifacts = await store.list_evidence_in_period(period_start, period_end)
    for art in artifacts:
        cid = art.get("control_id") or ""
        if cid:
            if cid not in controls_summary:
                controls_summary[cid] = {"pass": 0, "fail": 0, "not_applicable": 0, "error": 0, "artifacts": []}
            controls_summary[cid]["artifacts"].append({
                "id": art["id"],
                "file_name": art["file_name"],
                "s3_key": art["s3_key"],
                "checksum": art.get("checksum"),
            })

    control_by_id: dict[str, dict] = {}
    for cid in controls_summary:
        ctrl = await store.get_control(cid)
        if ctrl:
            control_by_id[cid] = ctrl

    manifest = {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "controls": [
            {
                "control_id": cid,
                "external_id": control_by_id[cid]["external_id"] if cid in control_by_id else cid,
                "title": control_by_id[cid]["title"] if cid in control_by_id else "",
                "summary": summary,
                "artifacts": summary.get("artifacts", []),
            }
            for cid, summary in controls_summary.items()
        ],
    }
    return manifest


def upload_manifest_to_s3(manifest: dict, bundle_s3_key: str) -> None:
    """Upload manifest JSON to S3."""
    client = _client()
    body = json.dumps(manifest, indent=2).encode("utf-8")
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=bundle_s3_key,
        Body=body,
        ContentType="application/json",
    )


async def build_hipaa_manifest(
    store: BackboardStore,
    period_start: datetime,
    period_end: datetime,
) -> dict:
    """Build a point-in-time HIPAA audit export bundle.

    Aggregates:
    - HIPAA control assessment results (pass/fail/na) for the period
    - Evidence artifacts linked to HIPAA controls
    - All 8 HIPAA-specific entity types (PHI assets, BAAs, training, etc.)
    - HIPAA audit log entries in the period
    """
    start_str = period_start.isoformat()
    end_str = period_end.isoformat()

    # ── Assessment results for HIPAA controls ────────────────────────────────
    hipaa_controls = await store.list_controls(framework="HIPAA-Security-Rule", limit=100)
    hipaa_control_ids = {c["id"] for c in hipaa_controls}

    runs = await store.list_runs(status="completed", limit=1000)
    run_ids = {r["id"] for r in runs if start_str <= r.get("started_at", "") <= end_str}

    controls_summary: dict[str, dict] = {}
    for run_id in run_ids:
        results = await store.list_results_for_run(run_id)
        for r in results:
            cid = r.get("control_id", "")
            if cid not in hipaa_control_ids:
                continue
            if cid not in controls_summary:
                controls_summary[cid] = {"pass": 0, "fail": 0, "not_applicable": 0, "error": 0, "artifacts": []}
            result_val = r.get("result", "error")
            if result_val in controls_summary[cid]:
                controls_summary[cid][result_val] += 1

    # ── Evidence artifacts for HIPAA controls ────────────────────────────────
    artifacts = await store.list_evidence_in_period(period_start, period_end)
    for art in artifacts:
        cid = art.get("control_id") or ""
        if cid in hipaa_control_ids:
            if cid not in controls_summary:
                controls_summary[cid] = {"pass": 0, "fail": 0, "not_applicable": 0, "error": 0, "artifacts": []}
            controls_summary[cid]["artifacts"].append({
                "id": art["id"],
                "file_name": art["file_name"],
                "s3_key": art["s3_key"],
                "checksum": art.get("checksum"),
            })

    ctrl_by_id = {c["id"]: c for c in hipaa_controls}

    # ── HIPAA-specific entity snapshots ──────────────────────────────────────
    hipaa_entities = await store.list_hipaa_entities_for_export()

    # ── HIPAA audit log for period ────────────────────────────────────────────
    audit_log = await store.list_hipaa_audit_log(limit=10000)
    period_audit_log = [
        e for e in audit_log
        if start_str <= e.get("timestamp", "") <= end_str
    ]

    manifest = {
        "framework": "HIPAA-Security-Rule",
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "controls": [
            {
                "control_id": cid,
                "external_id": ctrl_by_id[cid]["external_id"] if cid in ctrl_by_id else cid,
                "title": ctrl_by_id[cid]["title"] if cid in ctrl_by_id else "",
                "safeguard_category": next(
                    (p["value"] for p in (ctrl_by_id.get(cid, {}).get("raw_oscal_jsonb") or {}).get("props", [])
                     if p.get("name") == "safeguard_category"),
                    "",
                ),
                "summary": {k: v for k, v in summary.items() if k != "artifacts"},
                "artifacts": summary.get("artifacts", []),
            }
            for cid, summary in controls_summary.items()
        ],
        "phi_assets": hipaa_entities["phi_assets"],
        "baa_vendors": hipaa_entities["baa_vendors"],
        "training_records": hipaa_entities["training_records"],
        "risk_assessments": hipaa_entities["risk_assessments"],
        "incidents": hipaa_entities["incidents"],
        "contingency_evidence": hipaa_entities["contingency_evidence"],
        "access_reviews": hipaa_entities["access_reviews"],
        "policy_acknowledgements": hipaa_entities["policy_acknowledgements"],
        "audit_log_entries": period_audit_log,
    }
    return manifest
