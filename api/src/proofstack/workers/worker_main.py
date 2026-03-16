"""Run Temporal worker. Usage: uv run python -m proofstack.workers.worker_main"""

from __future__ import annotations

import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from proofstack.core.config import settings
from proofstack.workers import activities, workflows


async def main() -> None:
    client = await Client.connect(
        f"{settings.temporal_host}:{settings.temporal_port}",
        namespace=settings.temporal_namespace,
    )
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[
            workflows.ProwlerRunWorkflow,
            workflows.SteampipeRunWorkflow,
            workflows.CheckovRunWorkflow,
            workflows.TrivyRunWorkflow,
            workflows.CloudQuerySyncWorkflow,
            workflows.HIPAARiskAssessmentWorkflow,
            # Phase 3
            workflows.OnboardingWorkflow,
            workflows.OffboardingWorkflow,
            workflows.AccessReviewCampaignWorkflow,
            workflows.PolicyApprovalWorkflow,
            workflows.VendorOnboardingWorkflow,
            workflows.VendorDocumentExpiryWorkflow,
        ],
        activities=[
            activities.run_prowler_activity,
            activities.parse_prowler_output,
            activities.map_prowler_to_results,
            activities.process_prowler_results_activity,
            activities.complete_run_activity,
            activities.run_steampipe_activity,
            activities.run_checkov_activity,
            activities.run_trivy_activity,
            # HIPAA Phase 2
            activities.collect_phi_assets_activity,
            activities.run_prowler_hipaa_activity,
            activities.evaluate_opa_hipaa_activity,
            activities.score_risks_activity,
            # Phase 3
            activities.get_onboarding_completion_status,
            activities.get_offboarding_completion_status,
            activities.mark_workflow_run_completed,
            activities.check_vendor_document_expiry,
        ],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
