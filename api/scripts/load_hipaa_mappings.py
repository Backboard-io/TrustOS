#!/usr/bin/env -S uv run python
"""Load HIPAA Compliance Masonry mappings into Backboard as control_mapping memories.

Run from api/ directory with BACKBOARD_* env vars set:
    uv run python scripts/load_hipaa_mappings.py
"""

import asyncio
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from proofstack.core.backboard import BackboardStore


async def load_hipaa_mappings() -> None:
    mappings_file = (
        Path(__file__).resolve().parent.parent.parent / "seed" / "masonry" / "hipaa_mappings.yaml"
    )
    if not mappings_file.exists():
        print(f"Mappings file not found: {mappings_file}")
        sys.exit(1)

    with open(mappings_file) as f:
        doc = yaml.safe_load(f)

    store = BackboardStore()
    mems = await store._memories()
    loaded = 0
    skipped = 0

    for entry in doc.get("mappings", []):
        external_id = entry["control_external_id"]

        hits = store._find(mems, "control", external_id=external_id)
        if not hits:
            print(f"  ! Control not found in Backboard: {external_id} — run load_oscal_catalog.py first")
            continue
        _, ctrl = hits[0]
        control_catalog_id = ctrl["id"]

        for check in entry.get("checks", []):
            tool_id = check["tool_id"]
            ext_check_id = check["external_control_id"]

            existing = store._find(
                mems,
                "control_mapping",
                control_catalog_id=control_catalog_id,
                tool_id=tool_id,
                external_control_id=ext_check_id,
            )
            if existing:
                skipped += 1
                continue

            await store.create_control_mapping({
                "control_catalog_id": control_catalog_id,
                "tool_id": tool_id,
                "external_control_id": ext_check_id,
            })
            loaded += 1
            print(f"  + {external_id} → [{tool_id}] {ext_check_id}")

    print(f"\nDone — {loaded} mappings loaded, {skipped} skipped (already exist)")


if __name__ == "__main__":
    asyncio.run(load_hipaa_mappings())
