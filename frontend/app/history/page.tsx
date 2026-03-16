"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type HistoryEntry = {
  run_id: string;
  result: string;
  tool_id: string;
  created_at: string;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/runs/results/history?limit=200")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const passCount = history.filter((h) => h.result === "pass").length;
  const failCount = history.filter((h) => h.result === "fail").length;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Pass/fail history</h1>
        <p className="text-muted-foreground text-sm">Assessment results over time</p>
      </header>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <>
          <div className="flex gap-4 mb-6">
            <div className="border rounded p-4 min-w-[120px]">
              <p className="text-2xl font-semibold text-green-600">{passCount}</p>
              <p className="text-sm text-muted-foreground">Pass</p>
            </div>
            <div className="border rounded p-4 min-w-[120px]">
              <p className="text-2xl font-semibold text-red-600">{failCount}</p>
              <p className="text-sm text-muted-foreground">Fail</p>
            </div>
          </div>
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
                      <Link href={`/runs/${h.run_id}`} className="text-primary hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
