"""Health check endpoint."""

from fastapi import APIRouter

from proofstack.core.backboard import BackboardStore
from proofstack.schemas.common import HealthResponse
from proofstack.services.s3 import bucket_exists

router = APIRouter()


@router.get("", response_model=HealthResponse)
async def health_check():
    # Use the default (legacy) store just to ping Backboard
    store = BackboardStore()
    bb_ok = "ok"
    try:
        await store.ping()
    except Exception:
        bb_ok = "error"

    s3_status = "ok" if bucket_exists() else "unconfigured_or_missing"
    status = "ok" if bb_ok == "ok" else "degraded"
    return HealthResponse(status=status, database=bb_ok, s3=s3_status)
