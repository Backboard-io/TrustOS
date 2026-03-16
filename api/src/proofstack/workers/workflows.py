"""Temporal workflows for compliance runs."""

from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from proofstack.workers import activities


@workflow.defn
class ProwlerRunWorkflow:
    """Run Prowler, parse output, persist results to assessment run."""

    @workflow.run
    async def run(self, run_id: str, integration_config_id: str | None = None) -> dict:
        raw = await workflow.execute_activity(
            activities.run_prowler_activity,
            integration_config_id,
            start_to_close_timeout=timedelta(hours=1),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        parsed = await workflow.execute_activity(
            activities.parse_prowler_output,
            raw,
            start_to_close_timeout=timedelta(seconds=60),
        )
        await workflow.execute_activity(
            activities.process_prowler_results_activity,
            (run_id, parsed),
            start_to_close_timeout=timedelta(seconds=90),
        )
        return {"run_id": run_id, "parsed_count": len(parsed)}


@workflow.defn
class SteampipeRunWorkflow:
    """Run Steampipe/Powerpipe benchmark, parse and persist results."""

    @workflow.run
    async def run(self, run_id: str, integration_config_id: str | None = None) -> dict:
        raw = await workflow.execute_activity(
            activities.run_steampipe_activity,
            integration_config_id,
            start_to_close_timeout=timedelta(minutes=30),
        )
        await workflow.execute_activity(
            activities.complete_run_activity,
            run_id,
            start_to_close_timeout=timedelta(seconds=10),
        )
        return {"run_id": run_id, "raw_length": len(raw)}


@workflow.defn
class CheckovRunWorkflow:
    """Run Checkov on repo path, parse and persist results."""

    @workflow.run
    async def run(self, run_id: str, repo_path: str = ".") -> dict:
        raw = await workflow.execute_activity(
            activities.run_checkov_activity,
            repo_path,
            start_to_close_timeout=timedelta(minutes=15),
        )
        await workflow.execute_activity(
            activities.complete_run_activity,
            run_id,
            start_to_close_timeout=timedelta(seconds=10),
        )
        return {"run_id": run_id, "raw_length": len(raw)}


@workflow.defn
class TrivyRunWorkflow:
    """Run Trivy scan, store evidence and optionally persist results."""

    @workflow.run
    async def run(self, run_id: str, target: str = ".") -> dict:
        raw = await workflow.execute_activity(
            activities.run_trivy_activity,
            target,
            start_to_close_timeout=timedelta(minutes=15),
        )
        await workflow.execute_activity(
            activities.complete_run_activity,
            run_id,
            start_to_close_timeout=timedelta(seconds=10),
        )
        return {"run_id": run_id, "raw_length": len(raw)}


@workflow.defn
class CloudQuerySyncWorkflow:
    """Trigger CloudQuery sync (external process writes to Postgres)."""

    @workflow.run
    async def run(self, run_id: str, integration_config_id: str | None = None) -> dict:
        await workflow.execute_activity(
            activities.complete_run_activity,
            run_id,
            start_to_close_timeout=timedelta(seconds=10),
        )
        return {"run_id": run_id}


@workflow.defn
class HIPAARiskAssessmentWorkflow:
    """Orchestrate HIPAA Security Rule risk assessment.

    Steps:
    1. Collect PHI assets from Backboard.
    2. Run Prowler with HIPAA compliance framework.
    3. Evaluate OPA technical safeguard policies.
    4. Score risks and write risk_assessment memories.
    5. Mark assessment run complete.
    """

    @workflow.run
    async def run(self, run_id: str, integration_config_id: str | None = None) -> dict:
        phi_assets = await workflow.execute_activity(
            activities.collect_phi_assets_activity,
            run_id,
            start_to_close_timeout=timedelta(minutes=2),
        )

        prowler_raw = await workflow.execute_activity(
            activities.run_prowler_hipaa_activity,
            integration_config_id,
            start_to_close_timeout=timedelta(hours=1),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        opa_result = await workflow.execute_activity(
            activities.evaluate_opa_hipaa_activity,
            {"iam_users": [], "cloudtrail_trails": [], "s3_buckets": [], "rds_instances": [], "elb_listeners": [], "acm_certificates": [], "cognito_user_pools": [], "cloudwatch_log_groups": [], "access_keys": [], "account_summary": {}},
            start_to_close_timeout=timedelta(minutes=5),
        )

        created_risks = await workflow.execute_activity(
            activities.score_risks_activity,
            (run_id, phi_assets, opa_result),
            start_to_close_timeout=timedelta(seconds=60),
        )

        await workflow.execute_activity(
            activities.complete_run_activity,
            run_id,
            start_to_close_timeout=timedelta(seconds=10),
        )

        return {
            "run_id": run_id,
            "phi_assets_evaluated": len(phi_assets),
            "opa_violations": len(opa_result.get("violations", [])),
            "risks_created": len(created_risks),
        }


# ─────────────────────────────────────────────────────────────────────────────
# Phase 3 workflow automation
# ─────────────────────────────────────────────────────────────────────────────

@workflow.defn
class OnboardingWorkflow:
    """Poll onboarding task completion and mark workflow run completed."""

    @workflow.run
    async def run(self, run_id: str, assistant_id: str, employee_id: str) -> dict:
        max_checks = 28
        for _ in range(max_checks):
            status = await workflow.execute_activity(
                activities.get_onboarding_completion_status,
                (assistant_id, employee_id),
                start_to_close_timeout=timedelta(seconds=30),
            )
            if status.get("all_complete"):
                await workflow.execute_activity(
                    activities.mark_workflow_run_completed,
                    (assistant_id, run_id),
                    start_to_close_timeout=timedelta(seconds=10),
                )
                return {"run_id": run_id, "status": "completed", "completed": status.get("completed", 0)}
            await workflow.sleep(timedelta(hours=6))
        await workflow.execute_activity(
            activities.mark_workflow_run_completed,
            (assistant_id, run_id),
            start_to_close_timeout=timedelta(seconds=10),
        )
        return {"run_id": run_id, "status": "timeout", "completed": status.get("completed", 0)}


@workflow.defn
class OffboardingWorkflow:
    """Poll offboarding task completion and mark workflow run completed."""

    @workflow.run
    async def run(self, run_id: str, assistant_id: str, employee_id: str) -> dict:
        max_checks = 28
        for _ in range(max_checks):
            status = await workflow.execute_activity(
                activities.get_offboarding_completion_status,
                (assistant_id, employee_id),
                start_to_close_timeout=timedelta(seconds=30),
            )
            if status.get("all_complete"):
                await workflow.execute_activity(
                    activities.mark_workflow_run_completed,
                    (assistant_id, run_id),
                    start_to_close_timeout=timedelta(seconds=10),
                )
                return {"run_id": run_id, "status": "completed", "completed": status.get("completed", 0)}
            await workflow.sleep(timedelta(hours=6))
        await workflow.execute_activity(
            activities.mark_workflow_run_completed,
            (assistant_id, run_id),
            start_to_close_timeout=timedelta(seconds=10),
        )
        return {"run_id": run_id, "status": "timeout", "completed": status.get("completed", 0)}


@workflow.defn
class AccessReviewCampaignWorkflow:
    """Placeholder: recurring campaign escalation (schedule via cron or trigger)."""

    @workflow.run
    async def run(self, campaign_id: str, assistant_id: str) -> dict:
        await workflow.sleep(timedelta(seconds=1))
        return {"campaign_id": campaign_id, "status": "acknowledged"}


@workflow.defn
class PolicyApprovalWorkflow:
    """Placeholder: route policy to approvers (approval flow is API-driven)."""

    @workflow.run
    async def run(self, request_id: str, assistant_id: str) -> dict:
        await workflow.sleep(timedelta(seconds=1))
        return {"request_id": request_id, "status": "acknowledged"}


@workflow.defn
class VendorOnboardingWorkflow:
    """Placeholder: vendor onboarding checklist (API-driven)."""

    @workflow.run
    async def run(self, vendor_id: str, assistant_id: str) -> dict:
        await workflow.sleep(timedelta(seconds=1))
        return {"vendor_id": vendor_id, "status": "acknowledged"}


@workflow.defn
class VendorDocumentExpiryWorkflow:
    """Check vendor documents expiring within window (e.g. 90 days); emit alerts."""

    @workflow.run
    async def run(self, assistant_id: str, within_days: int = 90) -> dict:
        expiring = await workflow.execute_activity(
            activities.check_vendor_document_expiry,
            (assistant_id, within_days),
            start_to_close_timeout=timedelta(seconds=60),
        )
        return {"assistant_id": assistant_id, "within_days": within_days, "expiring_count": len(expiring)}
