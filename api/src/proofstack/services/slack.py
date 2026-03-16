"""Slack remediation: post message to webhook."""

from __future__ import annotations

import httpx

from proofstack.core.config import settings


def post_slack_message(
    text: str,
    webhook_url: str | None = None,
    blocks: list[dict] | None = None,
) -> str | None:
    """Post message to Slack webhook. Returns message_ts or None on failure."""
    url = webhook_url or settings.slack_webhook_url
    if not url:
        return None
    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    try:
        r = httpx.post(url, json=payload, timeout=10.0)
        if r.is_success:
            return "ok"  # Incoming webhooks don't return ts; use "ok" as external_id
        return None
    except Exception:
        return None
