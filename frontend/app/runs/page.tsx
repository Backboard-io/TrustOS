"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type Run = {
  id: string;
  type: string;
  integration_config_id: string | null;
  workflow_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
  trigger_metadata: Record<string, unknown> | null;
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/runs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setRuns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Automated checks</h1>
        <p className="text-muted-foreground text-sm">Assessment runs (Prowler, Steampipe, etc.)</p>
      </header>

      {loading && <p className="text-muted-foreground">Loading runs…</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Run ID</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Started</th>
                <th className="text-left p-2">Completed</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                  <td className="p-2">{r.type}</td>
                  <td className="p-2">
                    <span className={r.status === "completed" ? "text-green-600" : r.status === "failed" ? "text-red-600" : ""}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-2">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="p-2">{r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}</td>
                  <td className="p-2">
                    <Link href={`/runs/${r.id}`} className="text-primary hover:underline">View results</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
