"""Jira remediation: create issue from failed result."""

from __future__ import annotations

import httpx
from proofstack.core.config import settings


def create_jira_issue(
    project_key: str,
    summary: str,
    description: str,
    issue_type: str = "Task",
    base_url: str | None = None,
    email: str | None = None,
    api_token: str | None = None,
) -> str | None:
    """Create Jira issue. Returns issue key or None on failure."""
    base_url = (base_url or settings.jira_base_url or "").rstrip("/")
    auth = (email or settings.jira_email or "", api_token or settings.jira_api_token or "")
    if not base_url or not auth[1]:
        return None
    url = f"{base_url}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": summary,
            "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
            "issuetype": {"name": issue_type},
        }
    }
    try:
        r = httpx.post(
            url,
            json=payload,
            auth=auth,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=10.0,
        )
        if r.is_success:
            data = r.json()
            return data.get("key")
        return None
    except Exception:
        return None
