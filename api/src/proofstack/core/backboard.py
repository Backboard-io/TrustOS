"""Backboard client and store — replaces SQLAlchemy/Postgres."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from backboard import BackboardClient

from proofstack.core.config import settings

_client: BackboardClient | None = None


def get_client() -> BackboardClient:
    global _client
    if _client is None:
        _client = BackboardClient(api_key=settings.backboard_api_key)
    return _client


async def get_assistant_id_by_app_id(app_id: str) -> str | None:
    """Resolve app_id to assistant_id via registry (when registry_assistant_id is set)."""
    if not settings.registry_assistant_id:
        return None
    client = get_client()
    resp = await client.get_memories(settings.registry_assistant_id)
    for m in (resp.memories or []):
        try:
            data = json.loads(m.content)
            if data.get("app_id") == app_id:
                return data.get("assistant_id")
        except (json.JSONDecodeError, TypeError):
            continue
    return None


async def register_app_in_registry(app_id: str, assistant_id: str) -> None:
    """Register app_id -> assistant_id in registry (when registry_assistant_id is set)."""
    if not settings.registry_assistant_id:
        return
    client = get_client()
    await client.add_memory(
        assistant_id=settings.registry_assistant_id,
        content=json.dumps({"app_id": app_id, "assistant_id": assistant_id}),
        metadata={"type": "app_registry", "app_id": app_id},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


class BackboardStore:
    """Typed memory CRUD over a single Backboard assistant (one per app).

    Pass the app's assistant_id at construction time. Defaults to the legacy
    global assistant for backward compatibility during migration.
    """

    def __init__(self, assistant_id: str | None = None) -> None:
        self._client = get_client()
        self._aid = assistant_id or settings.backboard_assistant_id

    async def _memories(self) -> list:
        resp = await self._client.get_memories(self._aid)
        return list(resp.memories)

    async def _add(self, content: dict, metadata: dict) -> dict:
        content.setdefault("id", _new_id())
        content.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(content),
            metadata=metadata,
        )
        return content

    async def _replace(self, memory_id: str, content: dict, metadata: dict) -> None:
        """Backboard memories are immutable; update = delete + re-add."""
        content["updated_at"] = _now()
        await self._client.delete_memory(assistant_id=self._aid, memory_id=memory_id)
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(content),
            metadata=metadata,
        )

    def _find(self, memories: list, type_: str, **filters) -> list[tuple[Any, dict]]:
        """Return [(memory_obj, parsed_content)] matching type and all content filters."""
        results = []
        for m in memories:
            if (m.metadata or {}).get("type") != type_:
                continue
            data = json.loads(m.content)
            if all(data.get(k) == v or str(data.get(k)) == str(v) for k, v in filters.items()):
                results.append((m, data))
        return results

    # -------------------------------------------------------------------------
    # Controls (control_catalog)
    # -------------------------------------------------------------------------

    async def list_controls(
        self,
        framework: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "control")]
        if framework:
            rows = [r for r in rows if r.get("framework") == framework]
        rows.sort(key=lambda r: r.get("external_id", ""))
        return rows[skip : skip + limit]

    async def get_control(self, control_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "control", id=control_id)
        return hits[0][1] if hits else None

    async def get_control_by_external_id(self, external_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "control", external_id=external_id)
        return hits[0][1] if hits else None

    async def create_control(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "control",
                "record_id": data["id"],
                "framework": data.get("framework", ""),
            },
        )
        return data

    # -------------------------------------------------------------------------
    # Control mappings
    # -------------------------------------------------------------------------

    async def list_control_mappings(self, control_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "control_mapping", control_catalog_id=control_id)]

    async def create_control_mapping(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "control_mapping",
                "record_id": data["id"],
                "tool": data.get("tool_id", ""),
            },
        )
        return data

    # -------------------------------------------------------------------------
    # Integrations
    # -------------------------------------------------------------------------

    async def list_integrations(self) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "integration")]
        rows.sort(key=lambda r: (r.get("type", ""), r.get("name", "")))
        return rows

    async def get_integration(self, integration_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "integration", id=integration_id)
        return hits[0][1] if hits else None

    async def create_integration(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        data.setdefault("enabled", True)
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "integration",
                "record_id": data["id"],
            },
        )
        return data

    async def update_integration(self, integration_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "integration", id=integration_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {
            "type": "integration",
            "record_id": integration_id,
        })
        return data

    # -------------------------------------------------------------------------
    # Assessment runs
    # -------------------------------------------------------------------------

    async def list_runs(
        self,
        type_: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "assessment_run")]
        if type_:
            rows = [r for r in rows if r.get("type") == type_]
        if status:
            rows = [r for r in rows if r.get("status") == status]
        rows.sort(key=lambda r: r.get("started_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_run(self, run_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "assessment_run", id=run_id)
        return hits[0][1] if hits else None

    async def create_run(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("started_at", _now())
        data.setdefault("status", "running")
        data.setdefault("workflow_id", None)
        data.setdefault("completed_at", None)
        data.setdefault("integration_config_id", None)
        data.setdefault("trigger_metadata", None)
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "assessment_run",
                "record_id": data["id"],
            },
        )
        return data

    async def update_run(self, run_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "assessment_run", id=run_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {
            "type": "assessment_run",
            "record_id": run_id,
        })
        return data

    async def get_latest_completed_run(self) -> dict | None:
        runs = await self.list_runs(status="completed", limit=200)
        return runs[0] if runs else None

    async def get_last_run_for_integration(self, integration_id: str) -> dict | None:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "assessment_run", integration_config_id=integration_id)]
        rows.sort(key=lambda r: r.get("started_at", ""), reverse=True)
        return rows[0] if rows else None

    # -------------------------------------------------------------------------
    # Assessment results
    # -------------------------------------------------------------------------

    async def list_results_for_run(self, run_id: str) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "assessment_result", run_id=run_id)]
        rows.sort(key=lambda r: r.get("created_at", ""))
        return rows

    async def list_results_history(
        self,
        control_id: str | None = None,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "assessment_result")]
        if control_id:
            rows = [r for r in rows if r.get("control_id") == control_id]
        if from_at:
            from_str = from_at.isoformat()
            rows = [r for r in rows if r.get("created_at", "") >= from_str]
        if to_at:
            to_str = to_at.isoformat()
            rows = [r for r in rows if r.get("created_at", "") <= to_str]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows[:limit]

    async def create_result(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "assessment_result",
                "record_id": data["id"],
            },
        )
        return data

    async def count_results_for_run_by_result(self, run_id: str) -> dict[str, int]:
        rows = await self.list_results_for_run(run_id)
        counts: dict[str, int] = {}
        for r in rows:
            v = r.get("result", "error")
            counts[v] = counts.get(v, 0) + 1
        return counts

    # -------------------------------------------------------------------------
    # Evidence artifacts
    # -------------------------------------------------------------------------

    async def list_evidence(
        self,
        control_id: str | None = None,
        run_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "evidence")]
        if control_id:
            rows = [r for r in rows if r.get("control_id") == control_id]
        if run_id:
            rows = [r for r in rows if r.get("run_id") == run_id]
        rows.sort(key=lambda r: r.get("uploaded_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_evidence(self, artifact_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "evidence", id=artifact_id)
        return hits[0][1] if hits else None

    async def create_evidence(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("uploaded_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "evidence",
                "record_id": data["id"],
            },
        )
        return data

    async def list_evidence_in_period(self, period_start: datetime, period_end: datetime) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "evidence")]
        start_str = period_start.isoformat()
        end_str = period_end.isoformat()
        return [r for r in rows if start_str <= r.get("uploaded_at", "") <= end_str]

    # -------------------------------------------------------------------------
    # Remediation tickets
    # -------------------------------------------------------------------------

    async def list_remediation_tickets(
        self,
        channel: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "remediation_ticket")]
        if channel:
            rows = [r for r in rows if r.get("channel") == channel]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def create_remediation_ticket(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("status", "open")
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "remediation_ticket",
                "record_id": data["id"],
            },
        )
        return data

    # -------------------------------------------------------------------------
    # Audit export bundles
    # -------------------------------------------------------------------------

    async def get_audit_export(self, bundle_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "audit_export", id=bundle_id)
        return hits[0][1] if hits else None

    async def create_audit_export(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "audit_export",
                "record_id": data["id"],
            },
        )
        return data

    # -------------------------------------------------------------------------
    # Posture helpers
    # -------------------------------------------------------------------------

    async def count_controls(self, framework: str | None = None) -> int:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "control")]
        if framework:
            rows = [r for r in rows if r.get("framework") == framework]
        return len(rows)

    async def list_frameworks(self) -> list[str]:
        mems = await self._memories()
        return list({d.get("framework", "") for _, d in self._find(mems, "control") if d.get("framework")})

    # -------------------------------------------------------------------------
    # PHI Assets
    # -------------------------------------------------------------------------

    async def list_phi_assets(self, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "phi_asset")]
        rows.sort(key=lambda r: r.get("name", ""))
        return rows[skip : skip + limit]

    async def get_phi_asset(self, asset_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "phi_asset", id=asset_id)
        return hits[0][1] if hits else None

    async def create_phi_asset(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "phi_asset", "record_id": data["id"]},
        )
        return data

    async def update_phi_asset(self, asset_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "phi_asset", id=asset_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "phi_asset", "record_id": asset_id})
        return data

    async def delete_phi_asset(self, asset_id: str) -> bool:
        mems = await self._memories()
        hits = self._find(mems, "phi_asset", id=asset_id)
        if not hits:
            return False
        m, _ = hits[0]
        await self._client.delete_memory(assistant_id=self._aid, memory_id=m.id)
        return True

    # -------------------------------------------------------------------------
    # BAA Vendors
    # -------------------------------------------------------------------------

    async def list_baa_vendors(self, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "baa_vendor")]
        rows.sort(key=lambda r: r.get("vendor_name", ""))
        return rows[skip : skip + limit]

    async def get_baa_vendor(self, vendor_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "baa_vendor", id=vendor_id)
        return hits[0][1] if hits else None

    async def create_baa_vendor(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("status", "pending")
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "baa_vendor", "record_id": data["id"]},
        )
        return data

    async def update_baa_vendor(self, vendor_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "baa_vendor", id=vendor_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "baa_vendor", "record_id": vendor_id})
        return data

    async def list_expiring_baa_vendors(self, within_days: int = 90) -> list[dict]:
        from datetime import datetime, timezone, timedelta
        rows = await self.list_baa_vendors(limit=1000)
        cutoff = (datetime.now(timezone.utc) + timedelta(days=within_days)).date().isoformat()
        today = datetime.now(timezone.utc).date().isoformat()
        return [
            r for r in rows
            if r.get("baa_expiry_date") and today <= r["baa_expiry_date"] <= cutoff
        ]

    # -------------------------------------------------------------------------
    # Training Records
    # -------------------------------------------------------------------------

    async def list_training_records(
        self,
        user_email: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "training_record")]
        if user_email:
            rows = [r for r in rows if r.get("user_email") == user_email]
        if status:
            rows = [r for r in rows if r.get("status") == status]
        rows.sort(key=lambda r: r.get("due_at", ""))
        return rows[skip : skip + limit]

    async def create_training_record(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("status", "pending")
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "training_record", "record_id": data["id"]},
        )
        return data

    async def count_overdue_training(self) -> int:
        from datetime import datetime, timezone
        rows = await self.list_training_records(limit=10000)
        today = datetime.now(timezone.utc).date().isoformat()
        return sum(
            1 for r in rows
            if r.get("status") != "completed" and r.get("due_at", "9999") < today
        )

    # -------------------------------------------------------------------------
    # Risk Assessments
    # -------------------------------------------------------------------------

    async def list_risk_assessments(
        self,
        status: str | None = None,
        phi_asset_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "risk_assessment")]
        if status:
            rows = [r for r in rows if r.get("status") == status]
        if phi_asset_id:
            rows = [r for r in rows if r.get("phi_asset_id") == phi_asset_id]
        rows.sort(key=lambda r: r.get("risk_score", 0), reverse=True)
        return rows[skip : skip + limit]

    async def get_risk_assessment(self, risk_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "risk_assessment", id=risk_id)
        return hits[0][1] if hits else None

    async def create_risk_assessment(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        data.setdefault("status", "open")
        likelihood = data.get("likelihood", 1)
        impact = data.get("impact", 1)
        data["risk_score"] = likelihood * impact
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "risk_assessment", "record_id": data["id"]},
        )
        return data

    async def update_risk_assessment(self, risk_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "risk_assessment", id=risk_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        if "likelihood" in updates or "impact" in updates:
            data["risk_score"] = data.get("likelihood", 1) * data.get("impact", 1)
        await self._replace(m.id, data, {"type": "risk_assessment", "record_id": risk_id})
        return data

    async def count_open_risks(self) -> int:
        rows = await self.list_risk_assessments(status="open", limit=10000)
        return len(rows)

    # -------------------------------------------------------------------------
    # Incidents
    # -------------------------------------------------------------------------

    async def list_incidents(
        self,
        status: str | None = None,
        severity: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "incident")]
        if status:
            rows = [r for r in rows if r.get("status") == status]
        if severity:
            rows = [r for r in rows if r.get("severity") == severity]
        rows.sort(key=lambda r: r.get("discovered_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_incident(self, incident_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "incident", id=incident_id)
        return hits[0][1] if hits else None

    async def create_incident(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("status", "open")
        data.setdefault("resolved_at", None)
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "incident", "record_id": data["id"]},
        )
        return data

    async def update_incident(self, incident_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "incident", id=incident_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "incident", "record_id": incident_id})
        return data

    async def count_open_incidents(self) -> int:
        rows = await self.list_incidents(status="open", limit=10000)
        return len(rows)

    # -------------------------------------------------------------------------
    # Contingency Evidence
    # -------------------------------------------------------------------------

    async def list_contingency_evidence(
        self,
        plan_type: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "contingency_evidence")]
        if plan_type:
            rows = [r for r in rows if r.get("plan_type") == plan_type]
        rows.sort(key=lambda r: r.get("test_date", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_contingency_evidence(self, evidence_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "contingency_evidence", id=evidence_id)
        return hits[0][1] if hits else None

    async def create_contingency_evidence(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "contingency_evidence", "record_id": data["id"]},
        )
        return data

    async def update_contingency_evidence(self, evidence_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "contingency_evidence", id=evidence_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "contingency_evidence", "record_id": evidence_id})
        return data

    # -------------------------------------------------------------------------
    # Access Reviews
    # -------------------------------------------------------------------------

    async def list_access_reviews(
        self,
        system_name: str | None = None,
        decision: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "access_review")]
        if system_name:
            rows = [r for r in rows if r.get("system_name") == system_name]
        if decision:
            rows = [r for r in rows if r.get("decision") == decision]
        rows.sort(key=lambda r: r.get("next_review_date", ""))
        return rows[skip : skip + limit]

    async def get_access_review(self, review_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "access_review", id=review_id)
        return hits[0][1] if hits else None

    async def create_access_review(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "access_review", "record_id": data["id"]},
        )
        return data

    # -------------------------------------------------------------------------
    # Policy Acknowledgements
    # -------------------------------------------------------------------------

    async def list_policy_acknowledgements(
        self,
        policy_name: str | None = None,
        user_email: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "policy_acknowledgement")]
        if policy_name:
            rows = [r for r in rows if r.get("policy_name") == policy_name]
        if user_email:
            rows = [r for r in rows if r.get("user_email") == user_email]
        rows.sort(key=lambda r: r.get("next_due_at", ""))
        return rows[skip : skip + limit]

    async def create_policy_acknowledgement(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "policy_acknowledgement", "record_id": data["id"]},
        )
        return data

    # -------------------------------------------------------------------------
    # HIPAA Audit Log
    # -------------------------------------------------------------------------

    async def list_hipaa_audit_log(
        self,
        resource_type: str | None = None,
        actor_email: str | None = None,
        skip: int = 0,
        limit: int = 200,
    ) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "hipaa_audit_log")]
        if resource_type:
            rows = [r for r in rows if r.get("resource_type") == resource_type]
        if actor_email:
            rows = [r for r in rows if r.get("actor_email") == actor_email]
        rows.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
        return rows[skip : skip + limit]

    async def append_hipaa_audit_log(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("timestamp", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "hipaa_audit_log",
                "record_id": data["id"],
                "resource_type": data.get("resource_type", ""),
            },
        )
        return data

    # -------------------------------------------------------------------------
    # HIPAA dashboard helpers
    # -------------------------------------------------------------------------

    async def get_hipaa_dashboard_summary(self) -> dict:
        """Aggregate counts for the HIPAA dashboard."""
        mems = await self._memories()

        controls = [d for _, d in self._find(mems, "control") if d.get("framework") == "HIPAA-Security-Rule"]
        control_ids = {c["id"] for c in controls}

        results = [d for _, d in self._find(mems, "assessment_result") if d.get("control_id") in control_ids]

        safeguard_map: dict[str, dict[str, int]] = {
            "administrative": {"pass": 0, "fail": 0, "not_applicable": 0, "total": 0},
            "physical": {"pass": 0, "fail": 0, "not_applicable": 0, "total": 0},
            "technical": {"pass": 0, "fail": 0, "not_applicable": 0, "total": 0},
        }

        ctrl_by_id = {c["id"]: c for c in controls}
        for res in results:
            cid = res.get("control_id", "")
            ctrl = ctrl_by_id.get(cid)
            if not ctrl:
                continue
            raw = ctrl.get("raw_oscal_jsonb") or {}
            safeguard_category = ""
            for prop in raw.get("props", []):
                if prop.get("name") == "safeguard_category":
                    safeguard_category = prop["value"]
                    break
            if safeguard_category not in safeguard_map:
                continue
            result_val = res.get("result", "error")
            if result_val in ("pass", "fail", "not_applicable"):
                safeguard_map[safeguard_category][result_val] += 1
            safeguard_map[safeguard_category]["total"] += 1

        ctrl_with_results = {r.get("control_id") for r in results}
        missing_evidence_controls = [
            {"control_id": c["id"], "external_id": c.get("external_id"), "title": c.get("title")}
            for c in controls
            if c["id"] not in ctrl_with_results
        ]

        return {
            "safeguard_status": safeguard_map,
            "missing_evidence_controls": missing_evidence_controls,
            "overdue_training_count": await self.count_overdue_training(),
            "expiring_baa_count": len(await self.list_expiring_baa_vendors(within_days=90)),
            "open_risk_count": await self.count_open_risks(),
            "open_incident_count": await self.count_open_incidents(),
        }

    async def list_hipaa_entities_for_export(self) -> dict:
        """Return all HIPAA entity types for audit bundle assembly."""
        return {
            "phi_assets": await self.list_phi_assets(limit=10000),
            "baa_vendors": await self.list_baa_vendors(limit=10000),
            "training_records": await self.list_training_records(limit=10000),
            "risk_assessments": await self.list_risk_assessments(limit=10000),
            "incidents": await self.list_incidents(limit=10000),
            "contingency_evidence": await self.list_contingency_evidence(limit=10000),
            "access_reviews": await self.list_access_reviews(limit=10000),
            "policy_acknowledgements": await self.list_policy_acknowledgements(limit=10000),
        }

    # -------------------------------------------------------------------------
    # People workflows (employees, onboarding/offboarding tasks)
    # -------------------------------------------------------------------------

    async def list_employees(self, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "employee")]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_employee(self, employee_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "employee", id=employee_id)
        return hits[0][1] if hits else None

    async def create_employee(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "employee", "record_id": data["id"]},
        )
        return data

    async def update_employee(self, employee_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "employee", id=employee_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "employee", "record_id": employee_id})
        return data

    async def list_onboarding_tasks(self, employee_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "onboarding_task", employee_id=employee_id)]

    async def create_onboarding_task(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("status", "pending")
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "onboarding_task", "record_id": data["id"], "employee_id": data["employee_id"]},
        )
        return data

    async def update_onboarding_task(self, task_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "onboarding_task", id=task_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "onboarding_task", "record_id": task_id})
        return data

    async def list_offboarding_tasks(self, employee_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "offboarding_task", employee_id=employee_id)]

    async def create_offboarding_task(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("status", "pending")
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "offboarding_task", "record_id": data["id"], "employee_id": data["employee_id"]},
        )
        return data

    async def update_offboarding_task(self, task_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "offboarding_task", id=task_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "offboarding_task", "record_id": task_id})
        return data

    async def create_task_completion(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("completed_at", _now())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "task_completion", "record_id": data["id"]},
        )
        return data

    async def list_workflow_runs(self, workflow_type: str, status: str | None = None) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "workflow_run") if d.get("workflow_type") == workflow_type]
        if status:
            rows = [r for r in rows if r.get("status") == status]
        return rows

    async def create_workflow_run(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("status", "running")
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "workflow_run", "record_id": data["id"], "workflow_type": data.get("workflow_type", "")},
        )
        return data

    async def update_workflow_run(self, run_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "workflow_run", id=run_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "workflow_run", "record_id": run_id})
        return data

    # -------------------------------------------------------------------------
    # Access review campaigns
    # -------------------------------------------------------------------------

    async def list_campaigns(self, status: str | None = None, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "access_review_campaign")]
        if status:
            rows = [r for r in rows if r.get("status") == status]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_campaign(self, campaign_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "access_review_campaign", id=campaign_id)
        return hits[0][1] if hits else None

    async def create_campaign(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("status", "draft")
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "access_review_campaign", "record_id": data["id"]},
        )
        return data

    async def update_campaign(self, campaign_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "access_review_campaign", id=campaign_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "access_review_campaign", "record_id": campaign_id})
        return data

    async def list_attestations(self, campaign_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "reviewer_attestation", campaign_id=campaign_id)]

    async def create_attestation(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("attested_at", _now())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "reviewer_attestation", "record_id": data["id"], "campaign_id": data["campaign_id"]},
        )
        return data

    # -------------------------------------------------------------------------
    # Policy approval workflows
    # -------------------------------------------------------------------------

    async def list_policy_approval_requests(self, status: str | None = None, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "policy_approval_request")]
        if status:
            rows = [r for r in rows if r.get("status") == status]
        rows.sort(key=lambda r: r.get("submitted_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_policy_approval_request(self, request_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "policy_approval_request", id=request_id)
        return hits[0][1] if hits else None

    async def create_policy_approval_request(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("status", "pending")
        data.setdefault("submitted_at", _now())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "policy_approval_request", "record_id": data["id"]},
        )
        return data

    async def update_policy_approval_request(self, request_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "policy_approval_request", id=request_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "policy_approval_request", "record_id": request_id})
        return data

    async def list_policy_approval_decisions(self, request_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "policy_approval_decision", request_id=request_id)]

    async def create_policy_approval_decision(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("decided_at", _now())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "policy_approval_decision", "record_id": data["id"], "request_id": data["request_id"]},
        )
        return data

    # -------------------------------------------------------------------------
    # Vendors
    # -------------------------------------------------------------------------

    async def list_vendor_profiles(self, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "vendor_profile")]
        rows.sort(key=lambda r: r.get("name", ""))
        return rows[skip : skip + limit]

    async def get_vendor_profile(self, vendor_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "vendor_profile", id=vendor_id)
        return hits[0][1] if hits else None

    async def create_vendor_profile(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "vendor_profile", "record_id": data["id"]},
        )
        return data

    async def update_vendor_profile(self, vendor_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "vendor_profile", id=vendor_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "vendor_profile", "record_id": vendor_id})
        return data

    async def list_vendor_questionnaires(self, vendor_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "vendor_questionnaire", vendor_id=vendor_id)]

    async def get_vendor_questionnaire(self, questionnaire_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "vendor_questionnaire", id=questionnaire_id)
        return hits[0][1] if hits else None

    async def create_vendor_questionnaire(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "vendor_questionnaire", "record_id": data["id"], "vendor_id": data["vendor_id"]},
        )
        return data

    async def list_vendor_documents(self, vendor_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "vendor_document", vendor_id=vendor_id)]

    async def create_vendor_document(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "vendor_document", "record_id": data["id"], "vendor_id": data["vendor_id"]},
        )
        return data

    async def list_expiring_vendor_documents(self, within_days: int = 90) -> list[dict]:
        from datetime import datetime, timedelta, timezone
        mems = await self._memories()
        today_d = datetime.now(timezone.utc).date()
        cutoff_d = today_d + timedelta(days=within_days)
        today = today_d.strftime("%Y-%m-%d")
        cutoff = cutoff_d.strftime("%Y-%m-%d")
        rows = [d for _, d in self._find(mems, "vendor_document") if d.get("expiry_date")]
        out = []
        for r in rows:
            exp = r.get("expiry_date", "")
            if not exp or exp < today or exp > cutoff:
                continue
            try:
                d1 = datetime.strptime(exp, "%Y-%m-%d").date()
                r["days_until_expiry"] = (d1 - today_d).days
            except ValueError:
                r["days_until_expiry"] = 0
            out.append(r)
        return out

    async def list_questionnaire_responses(self, vendor_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "questionnaire_response", vendor_id=vendor_id)]

    async def create_questionnaire_response(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("submitted_at", _now())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "questionnaire_response", "record_id": data["id"], "vendor_id": data["vendor_id"]},
        )
        return data

    # -------------------------------------------------------------------------
    # Auditor workspaces and PBC
    # -------------------------------------------------------------------------

    async def list_auditor_workspaces(self, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "auditor_workspace")]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_auditor_workspace(self, workspace_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "auditor_workspace", id=workspace_id)
        return hits[0][1] if hits else None

    async def create_auditor_workspace(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("auditor_emails", [])
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "auditor_workspace", "record_id": data["id"]},
        )
        return data

    async def update_auditor_workspace(self, workspace_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "auditor_workspace", id=workspace_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "auditor_workspace", "record_id": workspace_id})
        return data

    async def list_pbc_items(self, workspace_id: str) -> list[dict]:
        mems = await self._memories()
        return [d for _, d in self._find(mems, "pbc_item", workspace_id=workspace_id)]

    async def get_pbc_item(self, item_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "pbc_item", id=item_id)
        return hits[0][1] if hits else None

    async def create_pbc_item(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("status", "open")
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={
                "type": "pbc_item",
                "record_id": data["id"],
                "workspace_id": data["workspace_id"],
                "request_id": data.get("request_id", ""),
            },
        )
        return data

    async def update_pbc_item(self, item_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "pbc_item", id=item_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "pbc_item", "record_id": item_id})
        return data

    # -------------------------------------------------------------------------
    # Trust center (documents, NDA, questionnaire library)
    # -------------------------------------------------------------------------

    async def list_trust_documents(self, is_public: bool | None = None, requires_nda: bool | None = None) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "trust_document")]
        if is_public is not None:
            rows = [r for r in rows if r.get("is_public") is is_public]
        if requires_nda is not None:
            rows = [r for r in rows if r.get("requires_nda") is requires_nda]
        return rows

    async def get_trust_document(self, doc_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "trust_document", id=doc_id)
        return hits[0][1] if hits else None

    async def create_trust_document(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("is_public", True)
        data.setdefault("requires_nda", False)
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "trust_document", "record_id": data["id"]},
        )
        return data

    async def update_trust_document(self, doc_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "trust_document", id=doc_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "trust_document", "record_id": doc_id})
        return data

    async def delete_trust_document(self, doc_id: str) -> bool:
        mems = await self._memories()
        hits = self._find(mems, "trust_document", id=doc_id)
        if not hits:
            return False
        m, _ = hits[0]
        await self._client.delete_memory(assistant_id=self._aid, memory_id=m.id)
        return True

    async def create_nda_record(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("signed_at", _now())
        data.setdefault("created_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "nda_record", "record_id": data["id"]},
        )
        return data

    async def get_nda_record_by_token(self, access_token: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "nda_record", access_token=access_token)
        return hits[0][1] if hits else None

    async def list_questionnaire_library(self, skip: int = 0, limit: int = 100) -> list[dict]:
        mems = await self._memories()
        rows = [d for _, d in self._find(mems, "questionnaire_library_entry")]
        rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return rows[skip : skip + limit]

    async def get_questionnaire_library_entry(self, entry_id: str) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "questionnaire_library_entry", id=entry_id)
        return hits[0][1] if hits else None

    async def create_questionnaire_library_entry(self, data: dict) -> dict:
        data.setdefault("id", _new_id())
        data.setdefault("created_at", _now())
        data.setdefault("updated_at", _now())
        await self._client.add_memory(
            assistant_id=self._aid,
            content=json.dumps(data),
            metadata={"type": "questionnaire_library_entry", "record_id": data["id"]},
        )
        return data

    async def update_questionnaire_library_entry(self, entry_id: str, updates: dict) -> dict | None:
        mems = await self._memories()
        hits = self._find(mems, "questionnaire_library_entry", id=entry_id)
        if not hits:
            return None
        m, data = hits[0]
        data.update(updates)
        await self._replace(m.id, data, {"type": "questionnaire_library_entry", "record_id": entry_id})
        return data

    # -------------------------------------------------------------------------
    # Ping
    # -------------------------------------------------------------------------

    async def ping(self) -> bool:
        try:
            await self._client.list_assistants()
            return True
        except Exception:
            return False
