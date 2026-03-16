#!/usr/bin/env python3
"""
Seed sample integrations into Backboard.

Run from the repo root:
    cd api && uv run python ../scripts/seed_integrations.py

Skips any integration whose name already exists. Safe to re-run.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api", "src"))

from dotenv import load_dotenv  # type: ignore

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from proofstack.core.backboard import BackboardStore  # noqa: E402

SAMPLES = [
    {
        "type": "prowler",
        "name": "Prowler — AWS CIS Benchmark",
        "config": {
            "provider": "aws",
            "region": "us-east-1",
            "checks": ["cis_level1"],
        },
        "credentials_ref": None,
        "enabled": True,
    },
    {
        "type": "steampipe",
        "name": "Steampipe — CIS AWS Queries",
        "config": {
            "query_file": "queries/cis_aws.sql",
            "plugin": "aws",
        },
        "credentials_ref": None,
        "enabled": True,
    },
    {
        "type": "checkov",
        "name": "Checkov — Terraform IaC Scan",
        "config": {
            "repo_path": ".",
            "framework": "terraform",
            "skip_checks": [],
        },
        "credentials_ref": None,
        "enabled": True,
    },
    {
        "type": "trivy",
        "name": "Trivy — Container Image Scan",
        "config": {
            "target": "proofstack-api:latest",
            "scanners": ["vuln", "secret", "config"],
            "severity": ["HIGH", "CRITICAL"],
        },
        "credentials_ref": None,
        "enabled": True,
    },
    {
        "type": "cloudquery",
        "name": "CloudQuery — AWS Asset Inventory",
        "config": {
            "provider": "aws",
            "tables": ["aws_s3_buckets", "aws_ec2_instances", "aws_iam_users"],
            "regions": ["us-east-1", "us-west-2"],
        },
        "credentials_ref": None,
        "enabled": True,
    },
    {
        "type": "slack",
        "name": "Slack — #security-alerts",
        "config": {
            "channel": "#security-alerts",
            "notify_on": ["run_failed", "run_completed"],
        },
        "credentials_ref": None,
        "enabled": False,
    },
    {
        "type": "jira",
        "name": "Jira — SEC Project Tickets",
        "config": {
            "project": "SEC",
            "issue_type": "Task",
            "labels": ["compliance", "proofstack"],
        },
        "credentials_ref": None,
        "enabled": False,
    },
]


async def main() -> None:
    api_key = os.environ.get("BACKBOARD_API_KEY")
    if not api_key:
        print("ERROR: BACKBOARD_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    store = BackboardStore()

    existing = await store.list_integrations()
    existing_names = {e["name"] for e in existing}

    print(f"Found {len(existing)} existing integrations.")
    print()

    created = 0
    for s in SAMPLES:
        if s["name"] in existing_names:
            print(f"  ↷  Skip '{s['name']}' (already exists)")
            continue
        await store.create_integration(s)
        status = "enabled" if s["enabled"] else "disabled"
        print(f"  ✓  Created '{s['name']}' ({s['type']}, {status})")
        created += 1

    print()
    print(f"Done. {created} integration(s) seeded, {len(existing_names)} skipped.")


if __name__ == "__main__":
    asyncio.run(main())
