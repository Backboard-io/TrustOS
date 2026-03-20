#!/usr/bin/env python3
"""
One-time setup: provisions the USERS_ASSISTANT_ID Backboard assistant.

Run once from the repo root:
    cd api && uv run python ../scripts/seed_users_assistant.py

Copy the printed assistant_id into .env as USERS_ASSISTANT_ID.
"""

import asyncio
import os
import sys

# Allow running from repo root or api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api", "src"))

from dotenv import load_dotenv  # type: ignore

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from backboard import BackboardClient  # noqa: E402


async def main() -> None:
    api_key = os.environ.get("BACKBOARD_API_KEY")
    if not api_key:
        print("ERROR: BACKBOARD_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    existing = os.environ.get("USERS_ASSISTANT_ID", "").strip()
    if existing:
        print(f"USERS_ASSISTANT_ID already set: {existing}")
        print("Nothing to do.")
        return

    client = BackboardClient(api_key=api_key)
    asst = await client.create_assistant(
        name="proofstack-users",
        system_prompt="Auth store for TrustOS users.",
    )
    print()
    print(f"✓ Created users assistant: {asst.assistant_id}")
    print()
    print("Add to .env:")
    print(f"  USERS_ASSISTANT_ID={asst.assistant_id}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
