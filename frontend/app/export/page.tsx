"use client";

import { apiFetch } from "@/lib/api";
import { useState } from "react";
type Bundle = {
  id: string;
  period_start: string;
  period_end: string;
  manifest: Record<string, unknown>;
  bundle_s3_key: string;
  created_at: string;
  download_url: string | null;
};

export default function ExportPage() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBundle(null);
    try {
      const r = await apiFetch("/api/v1/audit-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: periodStart + "T00:00:00Z",
          period_end: periodEnd + "T23:59:59Z",
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setBundle(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Audit export</h1>
        <p className="text-muted-foreground text-sm">Generate control-centric evidence bundle for auditors</p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Period start (date)</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="border rounded px-2 py-1.5 w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Period end (date)</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="border rounded px-2 py-1.5 w-full"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate export"}
        </button>
      </form>

      {error && <p className="mt-4 text-destructive">{error}</p>}
      {bundle && (
        <div className="mt-6 border rounded p-4">
          <p className="font-medium">Export ready</p>
          <p className="text-sm text-muted-foreground mt-1">
            {bundle.period_start} — {bundle.period_end}
          </p>
          {bundle.download_url ? (
            <a
              href={bundle.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-primary hover:underline"
            >
              Download bundle (JSON manifest)
            </a>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">S3 not configured; manifest stored in database.</p>
          )}
        </div>
      )}
    </div>
  );
}
