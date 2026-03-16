"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type Ticket = {
  id: string;
  result_id: string;
  run_id: string | null;
  channel: string;
  external_id: string;
  status: string;
  created_at: string;
};

export default function RemediationPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/remediation")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setTickets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Remediation</h1>
        <p className="text-muted-foreground text-sm">Slack and Jira tickets from failed results</p>
      </header>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Channel</th>
                <th className="text-left p-2">External ID</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Created</th>
                <th className="text-left p-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.channel}</td>
                  <td className="p-2 font-mono">{t.external_id}</td>
                  <td className="p-2">{t.status}</td>
                  <td className="p-2">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    {t.run_id ? (
                      <Link href={`/runs/${t.run_id}`} className="text-primary hover:underline">View run</Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tickets.length === 0 && <p className="p-4 text-muted-foreground">No remediation tickets yet. Create from a failed result (API: POST /remediation/slack or /remediation/jira).</p>}
        </div>
      )}
    </div>
  );
}
