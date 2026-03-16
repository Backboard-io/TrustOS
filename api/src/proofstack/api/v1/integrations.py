"""Integrations dashboard API."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

from proofstack.api.deps import get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.integration import (
    IntegrationConfigCreate,
    IntegrationConfigRead,
    IntegrationConfigUpdate,
    IntegrationConfigWithStatus,
)

router = APIRouter()


async def start_prowler_workflow(run_id: str, integration_config_id: str | None) -> None:
    try:
        from temporalio.client import Client
        from proofstack.core.config import settings
        from proofstack.workers.workflows import ProwlerRunWorkflow

        client = await Client.connect(
            f"{settings.temporal_host}:{settings.temporal_port}",
            namespace=settings.temporal_namespace,
        )
        await client.start_workflow(
            ProwlerRunWorkflow.run,
            run_id=run_id,
            integration_config_id=integration_config_id,
            id=f"prowler-{run_id}",
            task_queue=settings.temporal_task_queue,
        )
    except Exception:
        pass


async def start_generic_workflow(
    integration_type: str,
    run_id: str,
    integration_config_id: str,
    config: dict,
) -> None:
    try:
        from temporalio.client import Client
        from proofstack.core.config import settings
        from proofstack.workers.workflows import (
            SteampipeRunWorkflow,
            CheckovRunWorkflow,
            TrivyRunWorkflow,
            CloudQuerySyncWorkflow,
        )

        client = await Client.connect(
            f"{settings.temporal_host}:{settings.temporal_port}",
            namespace=settings.temporal_namespace,
        )
        workflow_id = f"{integration_type}-{run_id}"
        if integration_type == "steampipe":
            await client.start_workflow(
                SteampipeRunWorkflow.run,
                run_id=run_id,
                integration_config_id=integration_config_id,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
            )
        elif integration_type == "checkov":
            await client.start_workflow(
                CheckovRunWorkflow.run,
                run_id=run_id,
                repo_path=config.get("repo_path", "."),
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
            )
        elif integration_type == "trivy":
            await client.start_workflow(
                TrivyRunWorkflow.run,
                run_id=run_id,
                target=config.get("target", "."),
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
            )
        elif integration_type == "cloudquery":
            await client.start_workflow(
                CloudQuerySyncWorkflow.run,
                run_id=run_id,
                integration_config_id=integration_config_id,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
            )
    except Exception:
        pass


@router.get("", response_model=list[IntegrationConfigWithStatus])
async def list_integrations(store: BackboardStore = Depends(get_store)):
    configs = await store.list_integrations()
    out = []
    for c in configs:
        run = await store.get_last_run_for_integration(c["id"])
        out.append(
            IntegrationConfigWithStatus(
                **IntegrationConfigRead(**c).model_dump(),
                last_run_id=run["id"] if run else None,
                last_run_status=run["status"] if run else None,
                last_run_at=run["started_at"] if run else None,
            )
        )
    return out


@router.get("/{integration_id}", response_model=IntegrationConfigRead)
async def get_integration(
    integration_id: str,
    store: BackboardStore = Depends(get_store),
):
    row = await store.get_integration(integration_id)
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    return IntegrationConfigRead(**row)


@router.post("", response_model=IntegrationConfigRead, status_code=201)
async def create_integration(
    body: IntegrationConfigCreate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.create_integration(body.model_dump())
    return IntegrationConfigRead(**row)


@router.patch("/{integration_id}", response_model=IntegrationConfigRead)
async def update_integration(
    integration_id: str,
    body: IntegrationConfigUpdate,
    store: BackboardStore = Depends(get_store),
):
    row = await store.update_integration(integration_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    return IntegrationConfigRead(**row)


@router.post("/{integration_id}/sync", response_model=dict)
async def trigger_integration_sync(
    integration_id: str,
    background_tasks: BackgroundTasks,
    store: BackboardStore = Depends(get_store),
):
    row = await store.get_integration(integration_id)
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    if not row.get("enabled"):
        raise HTTPException(status_code=400, detail="Integration is disabled")

    run = await store.create_run({
        "type": "manual",
        "integration_config_id": row["id"],
        "status": "running",
    })
    itype = row.get("type", "")
    if itype == "prowler":
        await store.update_run(run["id"], {"workflow_id": f"prowler-{run['id']}"})
        background_tasks.add_task(start_prowler_workflow, run["id"], row["id"])
    elif itype in ("steampipe", "checkov", "trivy", "cloudquery"):
        await store.update_run(run["id"], {"workflow_id": f"{itype}-{run['id']}"})
        background_tasks.add_task(
            start_generic_workflow, itype, run["id"], row["id"], row.get("config", {})
        )
    return {"run_id": run["id"], "message": "Run started"}
