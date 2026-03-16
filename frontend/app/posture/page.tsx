"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type PostureSummary = {
  total_controls: number;
  pass_count: number;
  fail_count: number;
  not_applicable_count: number;
  error_count: number;
  last_assessment_at: string | null;
};

type PostureByFramework = {
  framework: string;
  total: number;
  pass_count: number;
  fail_count: number;
  not_applicable_count: number;
  error_count: number;
};

export default function PosturePage() {
  const [summary, setSummary] = useState<PostureSummary | null>(null);
  const [byFramework, setByFramework] = useState<PostureByFramework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/posture").then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText)))),
      apiFetch("/api/v1/posture/by-framework").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([s, b]) => {
        setSummary(s);
        setByFramework(b);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const passPct = summary && summary.total_controls > 0
    ? Math.round((summary.pass_count / summary.total_controls) * 100)
    : 0;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Compliance posture</h1>
        <p className="text-muted-foreground text-sm">Pass/fail summary and trends</p>
      </header>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="border rounded p-4">
              <p className="text-2xl font-semibold">{summary.total_controls}</p>
              <p className="text-sm text-muted-foreground">Total controls</p>
            </div>
            <div className="border rounded p-4">
              <p className="text-2xl font-semibold text-green-600">{summary.pass_count}</p>
              <p className="text-sm text-muted-foreground">Pass</p>
            </div>
            <div className="border rounded p-4">
              <p className="text-2xl font-semibold text-red-600">{summary.fail_count}</p>
              <p className="text-sm text-muted-foreground">Fail</p>
            </div>
            <div className="border rounded p-4">
              <p className="text-2xl font-semibold text-muted-foreground">{summary.not_applicable_count}</p>
              <p className="text-sm text-muted-foreground">N/A</p>
            </div>
            <div className="border rounded p-4">
              <p className="text-2xl font-semibold">{passPct}%</p>
              <p className="text-sm text-muted-foreground">Pass rate</p>
            </div>
          </div>
          {summary.last_assessment_at && (
            <p className="text-sm text-muted-foreground mb-4">
              Last assessment: {new Date(summary.last_assessment_at).toLocaleString()}
            </p>
          )}
          <h2 className="text-lg font-medium mb-2">By framework</h2>
          {byFramework.length === 0 ? (
            <p className="text-muted-foreground">No framework data. Run assessments and load control catalog.</p>
          ) : (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Framework</th>
                    <th className="text-left p-3">Total</th>
                    <th className="text-left p-3">Pass</th>
                    <th className="text-left p-3">Fail</th>
                    <th className="text-left p-3">N/A</th>
                    <th className="text-left p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {byFramework.map((f) => (
                    <tr key={f.framework} className="border-t hover:bg-muted/20">
                      <td className="p-3 font-medium">
                        <span className={[
                          "text-xs font-medium px-2 py-0.5 rounded mr-2",
                          f.framework === "HIPAA-Security-Rule"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            : "bg-bb-blue/10 text-bb-blue",
                        ].join(" ")}>
                          {f.framework === "HIPAA-Security-Rule" ? "HIPAA" : f.framework}
                        </span>
                      </td>
                      <td className="p-3">{f.total}</td>
                      <td className="p-3 text-green-600 font-medium">{f.pass_count}</td>
                      <td className="p-3 text-red-600 font-medium">{f.fail_count}</td>
                      <td className="p-3 text-muted-foreground">{f.not_applicable_count}</td>
                      <td className="p-3">
                        <Link
                          href={`/controls?framework=${encodeURIComponent(f.framework)}`}
                          className="text-xs text-bb-blue hover:underline"
                        >
                          View controls →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
