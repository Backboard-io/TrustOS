#!/usr/bin/env -S uv run python
"""Seed HIPAA Phase 2 sample data for dev/demo.

Run from api/ directory:
    uv run python scripts/seed_hipaa_sample_data.py

Creates sample PHI assets, BAA vendors, training records, risk assessments,
incidents, contingency evidence records, access reviews, and policy acknowledgements.
"""

import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from proofstack.core.backboard import BackboardStore


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _date_offset(days: int) -> str:
    return (datetime.now(timezone.utc).date() + timedelta(days=days)).isoformat()


async def seed() -> None:
    store = BackboardStore()

    print("Seeding HIPAA sample data…\n")

    # ── PHI Assets ────────────────────────────────────────────────────────────
    print("PHI Assets:")
    phi_assets = [
        {
            "name": "Patient EHR Database",
            "description": "Primary electronic health record system hosted on RDS",
            "data_classification": "ePHI",
            "system_owner": "clinical-eng@example.com",
            "location": "AWS RDS PostgreSQL us-east-1",
            "encryption_at_rest": True,
            "encryption_in_transit": True,
            "retention_period_days": 2555,
        },
        {
            "name": "Lab Results S3 Bucket",
            "description": "Diagnostic lab results uploaded by partner labs",
            "data_classification": "ePHI",
            "system_owner": "data-eng@example.com",
            "location": "AWS S3 us-east-1 bucket: phi-lab-results-prod",
            "encryption_at_rest": True,
            "encryption_in_transit": True,
            "retention_period_days": 2555,
        },
        {
            "name": "Patient Portal Web App",
            "description": "Patient-facing web portal for appointments and records access",
            "data_classification": "ePHI",
            "system_owner": "platform-eng@example.com",
            "location": "AWS ECS Fargate us-east-1",
            "encryption_at_rest": False,
            "encryption_in_transit": True,
            "retention_period_days": None,
        },
        {
            "name": "Billing System",
            "description": "Medical billing and claims processing platform",
            "data_classification": "PHI",
            "system_owner": "finance-eng@example.com",
            "location": "On-prem datacenter, NYC",
            "encryption_at_rest": False,
            "encryption_in_transit": False,
            "retention_period_days": 2555,
        },
    ]
    for a in phi_assets:
        rec = await store.create_phi_asset(a)
        print(f"  + {rec['name']} ({rec['data_classification']})")

    # ── BAA Vendors ────────────────────────────────────────────────────────────
    print("\nBAA Vendors:")
    baa_vendors = [
        {
            "vendor_name": "Amazon Web Services",
            "contact_email": "aws-hipaa@amazon.com",
            "services_provided": "Cloud infrastructure, storage, compute",
            "baa_signed_date": _date_offset(-365),
            "baa_expiry_date": _date_offset(365),
            "status": "active",
        },
        {
            "vendor_name": "Twilio (SMS notifications)",
            "contact_email": "compliance@twilio.com",
            "services_provided": "Patient appointment reminder SMS",
            "baa_signed_date": _date_offset(-180),
            "baa_expiry_date": _date_offset(60),  # expiring soon
            "status": "active",
        },
        {
            "vendor_name": "LabCorp",
            "contact_email": "hipaa@labcorp.com",
            "services_provided": "Laboratory testing and results delivery",
            "baa_signed_date": _date_offset(-400),
            "baa_expiry_date": _date_offset(-30),  # expired
            "status": "expired",
        },
        {
            "vendor_name": "Stripe (payment processing)",
            "contact_email": "hipaa@stripe.com",
            "services_provided": "Medical billing payment processing",
            "baa_signed_date": _date_offset(-90),
            "baa_expiry_date": _date_offset(275),
            "status": "active",
        },
    ]
    for v in baa_vendors:
        rec = await store.create_baa_vendor(v)
        print(f"  + {rec['vendor_name']} (expires {rec['baa_expiry_date']})")

    # ── Training Records ───────────────────────────────────────────────────────
    print("\nTraining Records:")
    training_records = [
        {"user_email": "alice@example.com", "course_name": "HIPAA Security Awareness Training", "due_at": _date_offset(-30), "completed_at": _date_offset(-45), "status": "completed"},
        {"user_email": "bob@example.com", "course_name": "HIPAA Security Awareness Training", "due_at": _date_offset(-30), "completed_at": None, "status": "overdue"},
        {"user_email": "carol@example.com", "course_name": "HIPAA Security Awareness Training", "due_at": _date_offset(30), "completed_at": None, "status": "pending"},
        {"user_email": "dave@example.com", "course_name": "PHI Handling Procedures", "due_at": _date_offset(-15), "completed_at": None, "status": "overdue"},
        {"user_email": "alice@example.com", "course_name": "Incident Response Training", "due_at": _date_offset(60), "completed_at": _date_offset(-5), "status": "completed"},
        {"user_email": "carol@example.com", "course_name": "PHI Handling Procedures", "due_at": _date_offset(45), "completed_at": None, "status": "pending"},
    ]
    for t in training_records:
        rec = await store.create_training_record(t)
        print(f"  + {rec['user_email']} — {rec['course_name']} ({rec['status']})")

    # ── Risk Assessments ───────────────────────────────────────────────────────
    print("\nRisk Assessments:")
    risk_assessments = [
        {
            "title": "Unauthorized access to ePHI database",
            "threat": "External attacker exploiting weak credentials",
            "vulnerability": "No MFA enforced on RDS admin accounts; weak password policy",
            "likelihood": 3,
            "impact": 5,
            "mitigation": "Enforce MFA on all admin accounts; implement IAM database authentication",
            "status": "open",
        },
        {
            "title": "Unencrypted PHI in billing system",
            "threat": "Insider threat or physical theft",
            "vulnerability": "On-prem billing system lacks encryption at rest",
            "likelihood": 2,
            "impact": 4,
            "mitigation": "Enable BitLocker or equivalent; migrate to encrypted cloud storage",
            "status": "open",
        },
        {
            "title": "Expired BAA with LabCorp",
            "threat": "Regulatory exposure from BAA gap",
            "vulnerability": "Business associate agreement lapsed 30 days ago",
            "likelihood": 4,
            "impact": 3,
            "mitigation": "Renew BAA with LabCorp or cease data transmission until renewed",
            "status": "open",
        },
        {
            "title": "Patient portal session timeout",
            "threat": "Session hijacking after unattended terminal",
            "vulnerability": "Patient portal lacks automatic session timeout per §164.312(a)(1)",
            "likelihood": 2,
            "impact": 3,
            "mitigation": "Implement 15-minute session timeout; add session activity logging",
            "status": "mitigated",
        },
    ]
    for r in risk_assessments:
        rec = await store.create_risk_assessment(r)
        print(f"  + [{rec['risk_score']:2d}] {rec['title']} ({rec['status']})")

    # ── Incidents ─────────────────────────────────────────────────────────────
    print("\nIncidents:")
    incidents = [
        {
            "title": "Phishing email targeting clinical staff",
            "description": "3 clinical staff members received targeted phishing emails impersonating IT. No credentials were compromised.",
            "phi_involved": False,
            "discovered_at": datetime.now(timezone.utc) - timedelta(days=10),
            "status": "resolved",
            "severity": "medium",
            "breach_notification_required": False,
        },
        {
            "title": "Unauthorized API access attempt",
            "description": "Automated scan detected credential stuffing attack against patient portal API. 2 accounts temporarily locked.",
            "phi_involved": True,
            "discovered_at": datetime.now(timezone.utc) - timedelta(days=3),
            "status": "investigating",
            "severity": "high",
            "breach_notification_required": False,
        },
    ]
    for i in incidents:
        data = dict(i)
        data["discovered_at"] = data["discovered_at"].isoformat()
        rec = await store.create_incident(data)
        print(f"  + {rec['title']} ({rec['severity']}, {rec['status']})")

    # ── Contingency Evidence ───────────────────────────────────────────────────
    print("\nContingency Evidence:")
    contingency = [
        {
            "plan_type": "backup",
            "description": "Daily automated RDS snapshots verified; restore test completed in 45 minutes within 4-hour RTO.",
            "test_date": _date_offset(-30),
            "result": "pass",
        },
        {
            "plan_type": "dr",
            "description": "Quarterly disaster recovery exercise; failover to us-west-2 completed. Billing system failover failed.",
            "test_date": _date_offset(-90),
            "result": "fail",
        },
        {
            "plan_type": "emergency_mode",
            "description": "Emergency mode operation runbook reviewed and updated. On-call procedures documented.",
            "test_date": _date_offset(-60),
            "result": "pass",
        },
        {
            "plan_type": "testing",
            "description": "Annual HIPAA contingency plan review; all procedures verified current with infrastructure.",
            "test_date": _date_offset(-180),
            "result": "pass",
        },
    ]
    for c in contingency:
        rec = await store.create_contingency_evidence(c)
        print(f"  + {rec['plan_type'].upper()} — {rec['result'].upper()} ({rec['test_date']})")

    # ── Access Reviews ─────────────────────────────────────────────────────────
    print("\nAccess Reviews:")
    access_reviews = [
        {
            "reviewer_email": "security@example.com",
            "reviewee_email": "alice@example.com",
            "system_name": "EMR (Epic)",
            "access_level": "Clinical Read/Write",
            "review_date": _date_offset(-30),
            "next_review_date": _date_offset(335),
            "decision": "approved",
        },
        {
            "reviewer_email": "security@example.com",
            "reviewee_email": "bob@example.com",
            "system_name": "EMR (Epic)",
            "access_level": "Admin",
            "review_date": _date_offset(-90),
            "next_review_date": _date_offset(-5),  # overdue
            "decision": "approved",
        },
        {
            "reviewer_email": "security@example.com",
            "reviewee_email": "contractor@vendor.com",
            "system_name": "AWS Console",
            "access_level": "PowerUser",
            "review_date": _date_offset(-180),
            "next_review_date": _date_offset(-20),  # overdue
            "decision": "pending",
        },
    ]
    for a in access_reviews:
        rec = await store.create_access_review(a)
        print(f"  + {rec['reviewee_email']} → {rec['system_name']} ({rec['decision']})")

    # ── Policy Acknowledgements ────────────────────────────────────────────────
    print("\nPolicy Acknowledgements:")
    policy_acks = [
        {
            "policy_name": "HIPAA Security Policy",
            "policy_version": "2.1",
            "user_email": "alice@example.com",
            "acknowledged_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),
            "next_due_at": _date_offset(335),
        },
        {
            "policy_name": "HIPAA Security Policy",
            "policy_version": "2.1",
            "user_email": "bob@example.com",
            "acknowledged_at": (datetime.now(timezone.utc) - timedelta(days=380)).isoformat(),
            "next_due_at": _date_offset(-15),  # overdue
        },
        {
            "policy_name": "Incident Response Policy",
            "policy_version": "1.3",
            "user_email": "alice@example.com",
            "acknowledged_at": (datetime.now(timezone.utc) - timedelta(days=60)).isoformat(),
            "next_due_at": _date_offset(305),
        },
        {
            "policy_name": "Incident Response Policy",
            "policy_version": "1.3",
            "user_email": "carol@example.com",
            "acknowledged_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
            "next_due_at": _date_offset(355),
        },
    ]
    for p in policy_acks:
        rec = await store.create_policy_acknowledgement(p)
        print(f"  + {rec['user_email']} — {rec['policy_name']} v{rec['policy_version']} (next due {rec['next_due_at']})")

    print("\n✓ HIPAA sample data seeded successfully.")
    print("\nNext steps:")
    print("  1. Load HIPAA OSCAL catalog:")
    print("     uv run python scripts/load_oscal_catalog.py hipaa_security_rule_catalog.json HIPAA-Security-Rule")
    print("  2. Load HIPAA control mappings:")
    print("     uv run python scripts/load_hipaa_mappings.py")
    print("  3. Start the app: cd .. && ./start.sh")


if __name__ == "__main__":
    asyncio.run(seed())
