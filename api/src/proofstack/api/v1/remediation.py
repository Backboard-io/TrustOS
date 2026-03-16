"""Remediation (Slack/Jira) API."""

from fastapi import APIRouter, Depends, HTTPException, Query

from proofstack.api.deps import get_store
from proofstack.core.backboard import BackboardStore
from proofstack.schemas.remediation import (
    RemediationTicketRead,
    RemediationSlackCreate,
    RemediationJiraCreate,
)
from proofstack.services.slack import post_slack_message
from proofstack.services.jira import create_jira_issue

router = APIRouter()


@router.get("", response_model=list[RemediationTicketRead])
async def list_remediation_tickets(
    store: BackboardStore = Depends(get_store),
    channel: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    rows = await store.list_remediation_tickets(channel=channel, skip=skip, limit=limit)
    out = []
    for t in rows:
        result_row = None
        if t.get("result_id"):
            results = await store.list_results_for_run("")  # fetch by result_id below
            # look up the specific result to get run_id
            mems = await store._memories()
            hits = store._find(mems, "assessment_result", id=t["result_id"])
            result_row = hits[0][1] if hits else None
        out.append(
            RemediationTicketRead(
                id=t["id"],
                result_id=t["result_id"],
                run_id=result_row["run_id"] if result_row else None,
                channel=t["channel"],
                external_id=t["external_id"],
                status=t["status"],
                created_at=t["created_at"],
            )
        )
    return out


@router.post("/slack", response_model=RemediationTicketRead, status_code=201)
async def create_slack_remediation(
    body: RemediationSlackCreate,
    store: BackboardStore = Depends(get_store),
):
    mems = await store._memories()
    hits = store._find(mems, "assessment_result", id=str(body.result_id))
    if not hits:
        raise HTTPException(status_code=404, detail="Assessment result not found")
    ar = hits[0][1]

    ctrl_hits = store._find(mems, "control", id=ar.get("control_id", ""))
    control_label = ctrl_hits[0][1].get("external_id") if ctrl_hits else ar.get("control_id", "")

    text = body.message or f"Compliance fail: control {control_label} — result {ar['result']}"
    external_id = post_slack_message(text)
    if not external_id:
        raise HTTPException(status_code=502, detail="Slack webhook failed")

    ticket = await store.create_remediation_ticket({
        "result_id": ar["id"],
        "channel": "slack",
        "external_id": external_id,
        "status": "open",
    })
    return RemediationTicketRead(**ticket, run_id=ar.get("run_id"))


@router.post("/jira", response_model=RemediationTicketRead, status_code=201)
async def create_jira_remediation(
    body: RemediationJiraCreate,
    store: BackboardStore = Depends(get_store),
):
    mems = await store._memories()
    hits = store._find(mems, "assessment_result", id=str(body.result_id))
    if not hits:
        raise HTTPException(status_code=404, detail="Assessment result not found")
    ar = hits[0][1]

    ctrl_hits = store._find(mems, "control", id=ar.get("control_id", ""))
    control_label = ctrl_hits[0][1].get("external_id") if ctrl_hits else ar.get("control_id", "")

    summary = body.summary or f"Compliance: {control_label} failed"
    description = body.description or f"Control: {control_label}\nResult: {ar['result']}\nTool: {ar.get('tool_id', '')}"
    key = create_jira_issue(
        project_key=body.project_key,
        summary=summary,
        description=description,
    )
    if not key:
        raise HTTPException(status_code=502, detail="Jira API failed")

    ticket = await store.create_remediation_ticket({
        "result_id": ar["id"],
        "channel": "jira",
        "external_id": key,
        "status": "open",
    })
    return RemediationTicketRead(**ticket, run_id=ar.get("run_id"))
