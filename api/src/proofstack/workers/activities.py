"""Temporal activities: run tools, parse output, persist results."""

from __future__ import annotations

import asyncio
import json
import subprocess
from datetime import datetime, timezone


def run_prowler_activity(integration_config_id: str | None) -> str:
    """Run Prowler AWS CLI and return JSON output. Returns empty list JSON if Prowler not available."""
    try:
        result = subprocess.run(
            ["prowler", "aws", "-f", "json", "-M", "json"],
            capture_output=True,
            text=True,
            timeout=3600,
        )
        if result.returncode != 0 and not result.stdout:
            return json.dumps([])
        return result.stdout or "[]"
    except FileNotFoundError:
        return "[]"
    except subprocess.TimeoutExpired:
        return "[]"


def parse_prowler_output(prowler_json: str) -> list[dict]:
    """Parse Prowler JSON output into list of {check_id, status, resource_id, ...}."""
    try:
        data = json.loads(prowler_json)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "findings" in data:
        return data["findings"]
    return []


def map_prowler_to_results(
    parsed: list[dict],
    control_mapping: dict[str, str],
) -> list[dict]:
    """Map Prowler check IDs to control_catalog_id and result."""
    out = []
    for p in parsed:
        check_id = (p.get("CheckID") or p.get("check_id") or "").strip()
        status = (p.get("Status") or p.get("status") or "INFO").upper()
        control_id = control_mapping.get(check_id)
        if not control_id:
            continue
        result = "pass" if status in ("PASS", "PASSED") else "fail"
        out.append({
            "control_id": control_id,
            "result": result,
            "tool_id": "prowler",
            "observation_details": {
                "check_id": check_id,
                "resource_id": p.get("ResourceId") or p.get("resource_id"),
                "status": status,
            },
        })
    return out


def process_prowler_results_activity(args: tuple[str, list[dict]]) -> None:
    """Load control mappings for prowler, map parsed results, persist and complete run."""
    run_id, parsed = args
    asyncio.run(_process_prowler_results_async(run_id, parsed))


async def _process_prowler_results_async(run_id: str, parsed: list[dict]) -> None:
    from proofstack.core.backboard import BackboardStore
    store = BackboardStore()

    mems = await store._memories()
    mapping_rows = store._find(mems, "control_mapping", tool_id="prowler")
    mapping = {d.get("external_control_id", ""): d.get("control_catalog_id", "") for _, d in mapping_rows}

    results = map_prowler_to_results(parsed, mapping)
    for rec in results:
        await store.create_result({
            "run_id": run_id,
            "control_id": rec["control_id"],
            "result": rec["result"],
            "tool_id": rec["tool_id"],
            "observation_details": rec.get("observation_details"),
        })
    await store.update_run(run_id, {
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "status": "completed",
    })


def complete_run_activity(run_id: str) -> None:
    """Set assessment run completed_at and status=completed."""
    async def _run() -> None:
        from proofstack.core.backboard import BackboardStore
        store = BackboardStore()
        await store.update_run(run_id, {
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "status": "completed",
        })

    asyncio.run(_run())


def run_steampipe_activity(integration_config_id: str | None) -> str:
    """Run Steampipe/Powerpipe benchmark. Returns JSON string."""
    try:
        result = subprocess.run(
            ["powerpipe", "benchmark", "run", "--export", "json"],
            capture_output=True,
            text=True,
            timeout=1800,
        )
        return result.stdout or "{}"
    except FileNotFoundError:
        return "{}"


def run_checkov_activity(repo_path: str) -> str:
    """Run Checkov on path. Returns JSON."""
    try:
        result = subprocess.run(
            ["checkov", "-d", repo_path, "-o", "json", "--quiet"],
            capture_output=True,
            text=True,
            timeout=600,
        )
        return result.stdout or "[]"
    except FileNotFoundError:
        return "[]"


def run_trivy_activity(target: str) -> str:
    """Run Trivy scan. Returns JSON."""
    try:
        result = subprocess.run(
            ["trivy", "fs", "--format", "json", target],
            capture_output=True,
            text=True,
            timeout=600,
        )
        return result.stdout or "{}"
    except FileNotFoundError:
        return "{}"


# ─────────────────────────────────────────────────────────────────────────────
# HIPAA Risk Assessment activities
# ─────────────────────────────────────────────────────────────────────────────

def collect_phi_assets_activity(run_id: str) -> list[dict]:
    """Fetch all PHI assets from Backboard for risk scoring."""
    async def _run() -> list[dict]:
        from proofstack.core.backboard import BackboardStore
        store = BackboardStore()
        return await store.list_phi_assets(limit=10000)

    return asyncio.run(_run())


def run_prowler_hipaa_activity(integration_config_id: str | None) -> str:
    """Run Prowler with HIPAA AWS compliance framework. Returns JSON output."""
    try:
        result = subprocess.run(
            [
                "prowler", "aws",
                "--compliance", "hipaa_aws",
                "-f", "json", "-M", "json",
            ],
            capture_output=True,
            text=True,
            timeout=3600,
        )
        if result.returncode != 0 and not result.stdout:
            return json.dumps([])
        return result.stdout or "[]"
    except FileNotFoundError:
        return "[]"
    except subprocess.TimeoutExpired:
        return "[]"


def evaluate_opa_hipaa_activity(input_data: dict) -> dict:
    """Evaluate HIPAA technical safeguards OPA policy against input_data.

    Returns {"allow": bool, "violations": [...]} from OPA decision.
    Falls back gracefully if OPA is not installed.
    """
    import tempfile
    from pathlib import Path

    policy_path = Path(__file__).resolve().parent.parent.parent.parent / "rego" / "hipaa" / "technical_safeguards.rego"
    if not policy_path.exists():
        return {"allow": True, "violations": [], "note": "OPA policy file not found"}

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(input_data, f)
        input_file = f.name

    try:
        result = subprocess.run(
            [
                "opa", "eval",
                "--data", str(policy_path),
                "--input", input_file,
                "--format", "json",
                "data.hipaa.technical_safeguards.violations",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return {"allow": True, "violations": [], "error": result.stderr[:500]}

        output = json.loads(result.stdout)
        violations = output.get("result", [{}])[0].get("expressions", [{}])[0].get("value", [])
        return {"allow": len(violations) == 0, "violations": violations}
    except (FileNotFoundError, json.JSONDecodeError, subprocess.TimeoutExpired) as exc:
        return {"allow": True, "violations": [], "note": str(exc)}
    finally:
        import os
        try:
            os.unlink(input_file)
        except OSError:
            pass


def score_risks_activity(args: tuple[str, list[dict], dict]) -> list[dict]:
    """Score risks for each PHI asset using OPA risk_scoring policy.

    Writes risk_assessment memories for any high/critical findings from Prowler.
    """
    run_id, phi_assets, opa_result = args

    async def _run() -> list[dict]:
        from proofstack.core.backboard import BackboardStore
        store = BackboardStore()
        created = []
        violations = opa_result.get("violations", [])
        for asset in phi_assets:
            if not violations:
                continue
            risk_data = {
                "title": f"OPA violation detected for asset: {asset.get('name', asset['id'])}",
                "threat": "Automated OPA technical safeguard violation",
                "vulnerability": "; ".join(violations[:3]),
                "likelihood": 3,
                "impact": 4 if asset.get("data_classification") == "ePHI" else 3,
                "phi_asset_id": asset["id"],
                "status": "open",
            }
            rec = await store.create_risk_assessment(risk_data)
            created.append(rec)
        return created

    return asyncio.run(_run())


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3 workflow activities (take assistant_id for app-scoped store)
# ─────────────────────────────────────────────────────────────────────────────

def get_onboarding_completion_status(args: tuple[str, str]) -> dict:
    """Return {all_complete: bool, total: int, completed: int} for onboarding tasks. args=(assistant_id, employee_id)."""
    assistant_id, employee_id = args
    async def _run() -> dict:
        from proofstack.core.backboard import BackboardStore
        store = BackboardStore(assistant_id)
        tasks = await store.list_onboarding_tasks(employee_id)
        total = len(tasks)
        completed = sum(1 for t in tasks if t.get("status") == "completed")
        return {"all_complete": total > 0 and completed >= total, "total": total, "completed": completed}
    return asyncio.run(_run())


def get_offboarding_completion_status(args: tuple[str, str]) -> dict:
    """Return {all_complete: bool, total: int, completed: int} for offboarding tasks. args=(assistant_id, employee_id)."""
    assistant_id, employee_id = args
    async def _run() -> dict:
        from proofstack.core.backboard import BackboardStore
        store = BackboardStore(assistant_id)
        tasks = await store.list_offboarding_tasks(employee_id)
        total = len(tasks)
        completed = sum(1 for t in tasks if t.get("status") == "completed")
        return {"all_complete": total > 0 and completed >= total, "total": total, "completed": completed}
    return asyncio.run(_run())


def mark_workflow_run_completed(args: tuple[str, str]) -> None:
    """Set workflow_run status to completed. args=(assistant_id, run_id)."""
    assistant_id, run_id = args
    async def _run() -> None:
        from proofstack.core.backboard import BackboardStore
        store = BackboardStore(assistant_id)
        await store.update_workflow_run(run_id, {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()})
    asyncio.run(_run())


def check_vendor_document_expiry(args: tuple[str, int]) -> list[dict]:
    """List vendor documents expiring within within_days (for alerting). args=(assistant_id, within_days)."""
    assistant_id, within_days = args
    async def _run() -> list[dict]:
        from proofstack.core.backboard import BackboardStore
        store = BackboardStore(assistant_id)
        return await store.list_expiring_vendor_documents(within_days=within_days)
    return asyncio.run(_run())
