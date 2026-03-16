"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type HistoryEntry = {
  run_id: string;
  result: string;
  tool_id: string;
  created_at: string;
};

export default function ControlHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/v1/controls/${id}/history`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (error) return <p className="p-6 text-destructive">{error}</p>;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Pass/fail history</h1>
      {history.length === 0 ? (
        <p className="text-muted-foreground">No assessment results yet.</p>
      ) : (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Result</th>
                <th className="text-left p-2">Tool</th>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Run</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    <span className={h.result === "pass" ? "text-green-600" : h.result === "fail" ? "text-red-600" : ""}>
                      {h.result}
                    </span>
                  </td>
                  <td className="p-2 font-mono">{h.tool_id}</td>
                  <td className="p-2">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    <Link href={`/runs/${h.run_id}`} className="text-primary hover:underline">View run</Link>
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
