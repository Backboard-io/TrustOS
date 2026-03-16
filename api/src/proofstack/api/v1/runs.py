"""Assessment runs API."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks

from proofstack.api.deps import get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.run import (
    AssessmentRunRead,
    AssessmentResultRead,
    AssessmentRunCreate,
    ControlHistoryEntry,
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


@router.get("", response_model=list[AssessmentRunRead])
async def list_runs(
    store: BackboardStore = Depends(get_store),
    type: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    rows = await store.list_runs(type_=type, status=status, skip=skip, limit=limit)
    return [AssessmentRunRead(**r) for r in rows]


@router.get("/{run_id}", response_model=AssessmentRunRead)
async def get_run(
    run_id: str,
    store: BackboardStore = Depends(get_store),
):
    row = await store.get_run(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    return AssessmentRunRead(**row)


@router.get("/{run_id}/results", response_model=list[AssessmentResultRead])
async def get_run_results(
    run_id: str,
    store: BackboardStore = Depends(get_store),
):
    rows = await store.list_results_for_run(run_id)
    return [AssessmentResultRead(**r) for r in rows]


@router.get("/results/history", response_model=list[ControlHistoryEntry])
async def list_results_history(
    store: BackboardStore = Depends(get_store),
    control_id: str | None = Query(None),
    from_at: datetime | None = Query(None, alias="from"),
    to_at: datetime | None = Query(None, alias="to"),
    limit: int = Query(100, ge=1, le=500),
):
    rows = await store.list_results_history(
        control_id=control_id,
        from_at=from_at,
        to_at=to_at,
        limit=limit,
    )
    return [
        ControlHistoryEntry(
            run_id=r["run_id"],
            result=r["result"],
            tool_id=r["tool_id"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.post("", response_model=AssessmentRunRead, status_code=201)
async def create_run(
    body: AssessmentRunCreate,
    background_tasks: BackgroundTasks,
    store: BackboardStore = Depends(get_store),
):
    run = await store.create_run({
        "type": body.type,
        "integration_config_id": str(body.integration_config_id) if body.integration_config_id else None,
        "trigger_metadata": body.trigger_metadata,
        "status": "running",
    })

    if body.integration_config_id:
        integration = await store.get_integration(str(body.integration_config_id))
        if integration and integration.get("type") == "prowler":
            workflow_id = f"prowler-{run['id']}"
            await store.update_run(run["id"], {"workflow_id": workflow_id})
            background_tasks.add_task(
                start_prowler_workflow,
                run["id"],
                str(body.integration_config_id),
            )

    return AssessmentRunRead(**run)
