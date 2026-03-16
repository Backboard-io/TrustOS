"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

type Result = {
  id: string;
  run_id: string;
  control_id: string;
  result: string;
  tool_id: string;
  observation_details: Record<string, unknown> | null;
  created_at: string;
};

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [run, setRun] = useState<Run | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/v1/runs/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText)))),
      apiFetch(`/api/v1/runs/${id}/results`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([r, res]) => {
        setRun(r);
        setResults(res);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (error || !run) return <p className="p-6 text-destructive">{error || "Not found"}</p>;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="border rounded p-6 mb-6">
        <h1 className="text-xl font-semibold">Run {run.id.slice(0, 8)}…</h1>
        <p className="text-sm text-muted-foreground mt-1">Type: {run.type} · Status: {run.status}</p>
        <p className="text-sm mt-1">Started: {new Date(run.started_at).toLocaleString()}</p>
        {run.completed_at && <p className="text-sm">Completed: {new Date(run.completed_at).toLocaleString()}</p>}
      </div>
      <h2 className="text-lg font-medium mb-2">Results</h2>
      {results.length === 0 ? (
        <p className="text-muted-foreground">No results yet.</p>
      ) : (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Control ID</th>
                <th className="text-left p-2">Result</th>
                <th className="text-left p-2">Tool</th>
                <th className="text-left p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.control_id.slice(0, 8)}…</td>
                  <td className="p-2">
                    <span className={r.result === "pass" ? "text-green-600" : r.result === "fail" ? "text-red-600" : ""}>
                      {r.result}
                    </span>
                  </td>
                  <td className="p-2 font-mono">{r.tool_id}</td>
                  <td className="p-2 text-muted-foreground">
                    {r.observation_details ? JSON.stringify(r.observation_details).slice(0, 60) + "…" : "—"}
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
