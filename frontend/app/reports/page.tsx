"use client";

import { apiFetch } from "@/lib/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useEffect, useState } from "react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type WorkflowMetrics = {
  onboarding_open: number;
  onboarding_closed: number;
  offboarding_open: number;
  offboarding_closed: number;
  policy_pending: number;
  policy_approved: number;
  policy_rejected: number;
};

type VendorRiskSummary = {
  total_vendors: number;
  by_tier: Record<string, number>;
  expiring_docs_90d: number;
  expiring_docs_30d: number;
};

export default function ReportsPage() {
  const [workflows, setWorkflows] = useState<WorkflowMetrics | null>(null);
  const [vendors, setVendors] = useState<VendorRiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/reports/workflows").then((r) => (r.ok ? r.json() : null)),
      apiFetch("/api/v1/reports/vendors").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([w, v]) => { setWorkflows(w); setVendors(v); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const barData = workflows
    ? {
        labels: ["Onboarding", "Offboarding", "Policy"],
        datasets: [
          {
            label: "Open / Pending",
            data: [workflows.onboarding_open, workflows.offboarding_open, workflows.policy_pending],
            backgroundColor: "rgba(59, 130, 246, 0.8)",
          },
          {
            label: "Closed / Approved",
            data: [workflows.onboarding_closed, workflows.offboarding_closed, workflows.policy_approved],
            backgroundColor: "rgba(34, 197, 94, 0.8)",
          },
        ],
      }
    : null;

  return (
    <div className="page-enter max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Workflow, campaign, vendor, and access-review metrics.</p>
      </header>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">Error: {error}</p>}

      {!loading && !error && (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Workflow metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {workflows && (
                <>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Onboarding open</p>
                    <p className="text-2xl font-semibold text-foreground">{workflows.onboarding_open}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Onboarding closed</p>
                    <p className="text-2xl font-semibold text-foreground">{workflows.onboarding_closed}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Policy pending</p>
                    <p className="text-2xl font-semibold text-foreground">{workflows.policy_pending}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Policy approved</p>
                    <p className="text-2xl font-semibold text-foreground">{workflows.policy_approved}</p>
                  </div>
                </>
              )}
            </div>
            {barData && (
              <div className="rounded-xl border border-border bg-[hsl(var(--card-bg))] p-4 h-64">
                <Bar
                  data={barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top" },
                      title: { display: true, text: "Workflow status" },
                    },
                    scales: {
                      y: { beginAtZero: true },
                    },
                  }}
                />
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Vendor risk summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {vendors && (
                <>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total vendors</p>
                    <p className="text-2xl font-semibold text-foreground">{vendors.total_vendors}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Expiring (90d)</p>
                    <p className="text-2xl font-semibold text-foreground">{vendors.expiring_docs_90d}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Expiring (30d)</p>
                    <p className="text-2xl font-semibold text-foreground">{vendors.expiring_docs_30d}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-[hsl(var(--card-bg))] p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">By tier</p>
                    <p className="text-sm text-muted-foreground">
                      {vendors.by_tier && Object.entries(vendors.by_tier).map(([t, n]) => `${t}: ${n}`).join(", ") || "—"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
