"""Control library API."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from proofstack.api.deps import get_global_store, get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.control import ControlCatalogRead, ControlMappingRead
from proofstack.schemas.run import ControlHistoryEntry

router = APIRouter()


@router.get("", response_model=list[ControlCatalogRead])
async def list_controls(
    catalog: BackboardStore = Depends(get_global_store),
    framework: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    rows = await catalog.list_controls(framework=framework, skip=skip, limit=limit)
    return [ControlCatalogRead(**r) for r in rows]


@router.get("/{control_id}", response_model=ControlCatalogRead)
async def get_control(
    control_id: str,
    catalog: BackboardStore = Depends(get_global_store),
):
    row = await catalog.get_control(control_id)
    if not row:
        raise HTTPException(status_code=404, detail="Control not found")
    return ControlCatalogRead(**row)


@router.get("/{control_id}/mappings", response_model=list[ControlMappingRead])
async def get_control_mappings(
    control_id: str,
    catalog: BackboardStore = Depends(get_global_store),
):
    rows = await catalog.list_control_mappings(control_id)
    return [ControlMappingRead(**r) for r in rows]


@router.get("/{control_id}/history", response_model=list[ControlHistoryEntry])
async def get_control_history(
    control_id: str,
    store: BackboardStore = Depends(get_store),
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
