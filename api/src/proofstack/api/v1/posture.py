"""Posture dashboard API."""

from fastapi import APIRouter, Depends, Query

from proofstack.api.deps import get_global_store, get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.posture import PostureSummary, PostureByFramework

router = APIRouter()


@router.get("", response_model=PostureSummary)
async def get_posture_summary(
    store: BackboardStore = Depends(get_store),
    catalog: BackboardStore = Depends(get_global_store),
    days: int = Query(30, ge=1, le=365),
):
    run = await store.get_latest_completed_run()
    last_assessment_at = None
    pass_count = fail_count = na_count = error_count = 0
    total_controls = await catalog.count_controls()

    if run:
        last_assessment_at = (run.get("completed_at") or run.get("started_at"))
        counts = await store.count_results_for_run_by_result(run["id"])
        pass_count = counts.get("pass", 0)
        fail_count = counts.get("fail", 0)
        na_count = counts.get("not_applicable", 0)
        error_count = counts.get("error", 0)

    return PostureSummary(
        total_controls=total_controls,
        pass_count=pass_count,
        fail_count=fail_count,
        not_applicable_count=na_count,
        error_count=error_count,
        last_assessment_at=last_assessment_at,
    )


@router.get("/by-framework", response_model=list[PostureByFramework])
async def get_posture_by_framework(
    store: BackboardStore = Depends(get_store),
    catalog: BackboardStore = Depends(get_global_store),
    days: int = Query(30, ge=1, le=365),
):
    frameworks = await catalog.list_frameworks()
    out = []
    for fw in frameworks:
        total = await catalog.count_controls(framework=fw)
        out.append(
            PostureByFramework(
                framework=fw,
                total=total,
                pass_count=0,
                fail_count=0,
                not_applicable_count=0,
                error_count=0,
            )
        )
    return out
