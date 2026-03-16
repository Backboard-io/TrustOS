"""People workflows API — employees, onboarding/offboarding tasks."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from proofstack.api.deps import get_store
from proofstack.core.auth import require_permission
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.people import (
    EmployeeCreate,
    EmployeeRecord,
    EmployeeUpdate,
    OffboardingCreate,
    OffboardingTask,
    OffboardingTaskCreate,
    OnboardingCreate,
    OnboardingTask,
    OnboardingTaskCreate,
    TaskCompletionCreate,
)

router = APIRouter()


def _employee_to_read(d: dict) -> EmployeeRecord:
    return EmployeeRecord(
        id=d["id"],
        email=d["email"],
        name=d["name"],
        department=d.get("department"),
        started_at=d.get("started_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _onboarding_task_to_read(d: dict) -> OnboardingTask:
    return OnboardingTask(
        id=d["id"],
        employee_id=d["employee_id"],
        title=d["title"],
        description=d.get("description"),
        status=d.get("status", "pending"),
        due_at=d.get("due_at"),
        completed_at=d.get("completed_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


def _offboarding_task_to_read(d: dict) -> OffboardingTask:
    return OffboardingTask(
        id=d["id"],
        employee_id=d["employee_id"],
        title=d["title"],
        description=d.get("description"),
        status=d.get("status", "pending"),
        due_at=d.get("due_at"),
        completed_at=d.get("completed_at"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


@router.get("", response_model=list[EmployeeRecord])
async def list_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    rows = await store.list_employees(skip=skip, limit=limit)
    return [_employee_to_read(r) for r in rows]


@router.post("", response_model=EmployeeRecord)
async def create_employee(
    body: EmployeeCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    data = body.model_dump()
    created = await store.create_employee(data)
    return _employee_to_read(created)


@router.get("/{employee_id}", response_model=EmployeeRecord)
async def get_employee(
    employee_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    row = await store.get_employee(employee_id)
    if not row:
        raise HTTPException(404, detail="Employee not found")
    return _employee_to_read(row)


@router.patch("/{employee_id}", response_model=EmployeeRecord)
async def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    updated = await store.update_employee(employee_id, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(404, detail="Employee not found")
    return _employee_to_read(updated)


@router.get("/{employee_id}/onboarding-tasks", response_model=list[OnboardingTask])
async def list_onboarding_tasks(
    employee_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    if not await store.get_employee(employee_id):
        raise HTTPException(404, detail="Employee not found")
    rows = await store.list_onboarding_tasks(employee_id)
    return [_onboarding_task_to_read(r) for r in rows]


@router.post("/{employee_id}/onboarding-tasks", response_model=OnboardingTask)
async def create_onboarding_task(
    employee_id: str,
    body: OnboardingTaskCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    if not await store.get_employee(employee_id):
        raise HTTPException(404, detail="Employee not found")
    data = body.model_dump() | {"employee_id": employee_id}
    created = await store.create_onboarding_task(data)
    return _onboarding_task_to_read(created)


@router.get("/{employee_id}/offboarding-tasks", response_model=list[OffboardingTask])
async def list_offboarding_tasks(
    employee_id: str,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:read")),
):
    if not await store.get_employee(employee_id):
        raise HTTPException(404, detail="Employee not found")
    rows = await store.list_offboarding_tasks(employee_id)
    return [_offboarding_task_to_read(r) for r in rows]


@router.post("/{employee_id}/offboarding-tasks", response_model=OffboardingTask)
async def create_offboarding_task(
    employee_id: str,
    body: OffboardingTaskCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    if not await store.get_employee(employee_id):
        raise HTTPException(404, detail="Employee not found")
    data = body.model_dump() | {"employee_id": employee_id}
    created = await store.create_offboarding_task(data)
    return _offboarding_task_to_read(created)


@router.post("/task-completions")
async def create_task_completion(
    body: TaskCompletionCreate,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    created = await store.create_task_completion(body.model_dump())
    task_id = body.task_id
    if body.task_type == "onboarding":
        await store.update_onboarding_task(task_id, {"status": "completed", "completed_at": created["completed_at"]})
    else:
        await store.update_offboarding_task(task_id, {"status": "completed", "completed_at": created["completed_at"]})
    return created


@router.post("/{employee_id}/trigger-onboarding")
async def trigger_onboarding(
    employee_id: str,
    body: OnboardingCreate | None = None,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    emp = await store.get_employee(employee_id)
    if not emp:
        raise HTTPException(404, detail="Employee not found")
    titles = (body.task_titles if body else OnboardingCreate(employee_id=employee_id).task_titles)
    for t in titles:
        await store.create_onboarding_task({"employee_id": employee_id, "title": t, "status": "pending"})
    run = await store.create_workflow_run({"workflow_type": "onboarding", "employee_id": employee_id, "status": "running"})
    return {"workflow_run_id": run["id"], "employee_id": employee_id, "tasks_created": len(titles)}


@router.post("/{employee_id}/trigger-offboarding")
async def trigger_offboarding(
    employee_id: str,
    body: OffboardingCreate | None = None,
    store: BackboardStore = Depends(get_store),
    _=Depends(require_permission("controls:write")),
):
    emp = await store.get_employee(employee_id)
    if not emp:
        raise HTTPException(404, detail="Employee not found")
    titles = (body.task_titles if body else OffboardingCreate(employee_id=employee_id).task_titles)
    for t in titles:
        await store.create_offboarding_task({"employee_id": employee_id, "title": t, "status": "pending"})
    run = await store.create_workflow_run({"workflow_type": "offboarding", "employee_id": employee_id, "status": "running"})
    return {"workflow_run_id": run["id"], "employee_id": employee_id, "tasks_created": len(titles)}
