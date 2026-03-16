"use client";

import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type Summary = {
  employees: number;
  active_campaigns: number;
  pending_policies: number;
  vendors: number;
  expiring_docs: number;
};

const CARDS = [
  {
    href: "/workflows/people",
    label: "People",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    desc: "Onboarding & offboarding compliance tasks",
    compliance: "SOC 2 CC6.2–6.3 · HIPAA §164.308(a)(3)",
    metricKey: "employees" as keyof Summary,
    metricLabel: "employees",
    accentClass: "text-blue-500",
    borderClass: "hover:border-blue-500/40",
  },
  {
    href: "/workflows/access-reviews",
    label: "Access Reviews",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    desc: "Recurring campaigns & reviewer attestations",
    compliance: "SOC 2 CC6.2, CC6.6 · HIPAA §164.308(a)(3)(ii)(B)",
    metricKey: "active_campaigns" as keyof Summary,
    metricLabel: "active campaigns",
    accentClass: "text-violet-500",
    borderClass: "hover:border-violet-500/40",
  },
  {
    href: "/workflows/policies",
    label: "Policy Approvals",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    desc: "Policy version submission and approval routing",
    compliance: "SOC 2 CC1.3–1.4 · HIPAA §164.316",
    metricKey: "pending_policies" as keyof Summary,
    metricLabel: "pending approvals",
    accentClass: "text-amber-500",
    borderClass: "hover:border-amber-500/40",
  },
  {
    href: "/workflows/vendors",
    label: "Vendors",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a48.536 48.536 0 0 1 5.25-1.316l2.25.657M3.75 9.35a48.524 48.524 0 0 1 4.125-1.086m10.5 0 1.636.476M3.75 9.35V5.25a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 .75.75v4.1m-16.5 0a48.52 48.52 0 0 1 16.5 0" />
      </svg>
    ),
    desc: "Vendor tiering, questionnaires, and document expiry",
    compliance: "SOC 2 CC9.2 · HIPAA §164.308(b) BAAs",
    metricKey: "vendors" as keyof Summary,
    metricLabel: "vendors tracked",
    accentClass: "text-emerald-500",
    borderClass: "hover:border-emerald-500/40",
  },
];

export default function WorkflowsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/workflows/people").then((r) => r.ok ? r.json() : []),
      apiFetch("/api/v1/workflows/campaigns").then((r) => r.ok ? r.json() : []),
      apiFetch("/api/v1/workflows/policies").then((r) => r.ok ? r.json() : []),
      apiFetch("/api/v1/workflows/vendors").then((r) => r.ok ? r.json() : []),
      apiFetch("/api/v1/workflows/vendors/expiring?within_days=90").then((r) => r.ok ? r.json() : []),
    ]).then(([people, campaigns, policies, vendors, expiring]) => {
      setSummary({
        employees: people.length,
        active_campaigns: campaigns.filter((c: { status: string }) => c.status === "active").length,
        pending_policies: policies.filter((p: { status: string }) => p.status === "pending").length,
        vendors: vendors.length,
        expiring_docs: expiring.length,
      });
    });
  }, []);

  return (
    <div className="page-enter max-w-5xl">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">Phase 3</span>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Compliance Workflows</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Operational evidence for SOC 2 and HIPAA auditors — onboarding trails, quarterly access certifications,
          policy approval chains, and vendor risk tracking.
        </p>
      </header>

      {summary?.expiring_docs !== undefined && summary.expiring_docs > 0 && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd"/>
          </svg>
          <span><strong>{summary.expiring_docs}</strong> vendor document{summary.expiring_docs !== 1 ? "s" : ""} expiring within 90 days —{" "}
            <Link href="/workflows/vendors" className="underline underline-offset-2 hover:no-underline">review now</Link>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(({ href, label, icon, desc, compliance, metricKey, metricLabel, accentClass, borderClass }) => (
          <Link
            key={href}
            href={href}
            className={`group flex flex-col gap-3 rounded-xl border border-border bg-[hsl(var(--card-bg))] p-5 card-hover transition-all duration-200 ${borderClass}`}
          >
            <div className="flex items-start justify-between">
              <div className={`${accentClass} transition-transform duration-200 group-hover:scale-110`}>{icon}</div>
              {summary !== null && (
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {summary[metricKey]} <span className="font-normal">{metricLabel}</span>
                </span>
              )}
            </div>
            <div>
              <span className="text-base font-semibold text-foreground">{label}</span>
              <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-xs text-muted-foreground/60 font-mono">{compliance}</span>
              <span className={`text-xs font-medium ${accentClass} opacity-0 group-hover:opacity-100 transition-opacity`}>Open →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
