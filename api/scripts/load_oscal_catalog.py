#!/usr/bin/env -S uv run python
"""Load OSCAL-style catalog JSON into Backboard as control memories. Run from api/ with BACKBOARD_* vars set."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from proofstack.core.backboard import BackboardStore


async def load_catalog_file(path: Path, framework: str = "SOC2-TSC") -> None:
    with open(path) as f:
        data = json.load(f)

    catalog = data.get("catalog") or data
    controls = catalog.get("controls") or catalog.get("control") or []

    store = BackboardStore()
    loaded = 0
    skipped = 0

    for c in controls:
        cid = c.get("id") or c.get("control-id") or ""
        title = c.get("title") or ""
        if not cid or not title:
            continue

        desc = None
        if c.get("props"):
            for p in c["props"]:
                if p.get("name") == "description":
                    desc = p.get("value")
                    break
        if not desc and c.get("part"):
            for p in c["part"]:
                if p.get("name") == "objective":
                    desc = p.get("text", "")
                    break

        existing = await store.get_control_by_external_id(cid)
        if existing:
            skipped += 1
            continue

        await store.create_control({
            "external_id": cid,
            "title": title,
            "description": desc,
            "framework": framework,
            "raw_oscal_jsonb": c,
        })
        loaded += 1
        print(f"  + {cid}: {title[:60]}")

    print(f"\nDone — {loaded} loaded, {skipped} skipped (already exist)")


def main():
    seed_dir = Path(__file__).resolve().parent.parent.parent / "seed" / "oscal"

    # Allow: load_oscal_catalog.py [catalog_file] [framework]
    if len(sys.argv) >= 3:
        catalog_file = Path(sys.argv[1])
        framework = sys.argv[2]
    elif len(sys.argv) == 2:
        catalog_file = Path(sys.argv[1])
        framework = "SOC2-TSC"
    else:
        catalog_file = seed_dir / "soc2_tsc_catalog.json"
        framework = "SOC2-TSC"

    if not catalog_file.is_absolute():
        catalog_file = seed_dir / catalog_file

    if not catalog_file.exists():
        print(f"Catalog not found: {catalog_file}")
        sys.exit(1)

    print(f"Loading {catalog_file.name} as framework={framework}")
    asyncio.run(load_catalog_file(catalog_file, framework=framework))


if __name__ == "__main__":
    main()
