"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type SafeguardStatus = {
  pass: number;
  fail: number;
  not_applicable: number;
  total: number;
};

type MissingControl = {
  control_id: string;
  external_id: string | null;
  title: string | null;
};

type Dashboard = {
  safeguard_status: {
    administrative: SafeguardStatus;
    physical: SafeguardStatus;
    technical: SafeguardStatus;
  };
  missing_evidence_controls: MissingControl[];
  overdue_training_count: number;
  expiring_baa_count: number;
  open_risk_count: number;
  open_incident_count: number;
};

const SAFEGUARD_LABELS: Record<string, string> = {
  administrative: "Administrative §164.308",
  physical: "Physical §164.310",
  technical: "Technical §164.312",
};

function StatusBar({ pass, fail, total }: { pass: number; fail: number; total: number }) {
  if (total === 0) return <div className="h-2 rounded bg-muted" />;
  const passW = Math.round((pass / total) * 100);
  const failW = Math.round((fail / total) * 100);
  return (
    <div className="h-2 rounded overflow-hidden bg-muted flex">
      <div style={{ width: `${passW}%` }} className="bg-green-500" />
      <div style={{ width: `${failW}%` }} className="bg-red-500" />
    </div>
  );
}

export default function HIPAADashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/hipaa/dashboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">Phase 2</span>
          <h1 className="text-2xl font-semibold">HIPAA Security Rule</h1>
        </div>
        <p className="text-muted-foreground text-sm">45 CFR Part 164, Subpart C — Readiness dashboard</p>
      </header>

      {loading && <p className="text-muted-foreground">Loading dashboard…</p>}
      {error && <p className="text-destructive">Error: {error}</p>}

      {!loading && !error && !data && (
        <p className="text-muted-foreground">No data yet. Load HIPAA catalog and run assessments.</p>
      )}

      {!loading && !error && data && (
        <>
          {/* Alert chips */}
          <div className="flex flex-wrap gap-3 mb-8">
            {data.overdue_training_count > 0 && (
              <Link href="/hipaa/training?status=overdue" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm font-medium border border-amber-200 dark:border-amber-800">
                ⚠ {data.overdue_training_count} overdue training{data.overdue_training_count !== 1 ? "s" : ""}
              </Link>
            )}
            {data.expiring_baa_count > 0 && (
              <Link href="/hipaa/baa" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-sm font-medium border border-orange-200 dark:border-orange-800">
                ⏰ {data.expiring_baa_count} BAA{data.expiring_baa_count !== 1 ? "s" : ""} expiring soon
              </Link>
            )}
            {data.open_risk_count > 0 && (
              <Link href="/hipaa/risk-assessments" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm font-medium border border-red-200 dark:border-red-800">
                ✕ {data.open_risk_count} open risk{data.open_risk_count !== 1 ? "s" : ""}
              </Link>
            )}
            {data.open_incident_count > 0 && (
              <Link href="/hipaa/incidents" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm font-medium border border-red-200 dark:border-red-800">
                ✕ {data.open_incident_count} open incident{data.open_incident_count !== 1 ? "s" : ""}
              </Link>
            )}
            {data.overdue_training_count === 0 && data.expiring_baa_count === 0 && data.open_risk_count === 0 && data.open_incident_count === 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm font-medium border border-green-200 dark:border-green-800">
                ✓ No critical alerts
              </span>
            )}
          </div>

          {/* Safeguard status cards */}
          <h2 className="text-base font-semibold mb-3">Safeguard status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {(["administrative", "physical", "technical"] as const).map((cat) => {
              const s = data.safeguard_status[cat] ?? { pass: 0, fail: 0, not_applicable: 0, total: 0 };
              const passRate = s.total > 0 ? Math.round((s.pass / s.total) * 100) : null;
              return (
                <div key={cat} className="border rounded-lg p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">{SAFEGUARD_LABELS[cat]}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold">{passRate !== null ? `${passRate}%` : "—"}</span>
                    <span className="text-sm text-muted-foreground">pass rate</span>
                  </div>
                  <StatusBar pass={s.pass} fail={s.fail} total={s.total} />
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="text-green-600 font-medium">{s.pass} pass</span>
                    <span className="text-red-600 font-medium">{s.fail} fail</span>
                    <span>{s.not_applicable} N/A</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Missing evidence */}
          {data.missing_evidence_controls.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">
                Missing evidence
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {data.missing_evidence_controls.length} control{data.missing_evidence_controls.length !== 1 ? "s" : ""} with no results
                </span>
              </h2>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3">Control ID</th>
                      <th className="text-left p-3">Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.missing_evidence_controls.map((c) => (
                      <tr key={c.control_id} className="border-t">
                        <td className="p-3 font-mono text-muted-foreground text-xs">{c.external_id ?? c.control_id}</td>
                        <td className="p-3">{c.title ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
