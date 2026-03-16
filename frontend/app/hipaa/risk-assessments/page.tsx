"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type Risk = {
  id: string;
  title: string;
  threat: string;
  vulnerability: string;
  likelihood: number;
  impact: number;
  risk_score: number;
  mitigation: string | null;
  status: "open" | "mitigated" | "accepted";
  phi_asset_id: string | null;
  created_at: string;
};


function riskLevel(score: number): { label: string; cls: string } {
  if (score >= 20) return { label: "Critical", cls: "bg-red-600 text-white" };
  if (score >= 12) return { label: "High", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" };
  if (score >= 6) return { label: "Medium", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" };
  return { label: "Low", cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" };
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    mitigated: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    accepted: "bg-muted text-muted-foreground",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${styles[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}

export default function RiskAssessmentsPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    threat: "",
    vulnerability: "",
    likelihood: 3,
    impact: 3,
    mitigation: "",
    status: "open" as "open" | "mitigated" | "accepted",
  });

  const load = () => {
    setLoading(true);
    const q = statusFilter ? `?status=${statusFilter}` : "";
    apiFetch(`/api/v1/hipaa/risk-assessments${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setRisks(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/hipaa/risk-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, mitigation: form.mitigation || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowForm(false);
      setForm({ title: "", threat: "", vulnerability: "", likelihood: 3, impact: 3, mitigation: "", status: "open" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await apiFetch(`/api/v1/hipaa/risk-assessments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Risk Assessments</h1>
        <p className="text-muted-foreground text-sm">§164.308(a)(1) — Security management process risk analysis and management</p>
      </header>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Status:</label>
          <select className="border rounded px-2 py-1 text-sm bg-background" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="mitigated">Mitigated</option>
            <option value="accepted">Accepted</option>
          </select>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Add Risk"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">New risk assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Unauthorized access to ePHI database" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Threat *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.threat} onChange={(e) => setForm({ ...form, threat: e.target.value })} placeholder="External attacker, insider threat" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vulnerability *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.vulnerability} onChange={(e) => setForm({ ...form, vulnerability: e.target.value })} placeholder="Weak password policy, no MFA" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Likelihood (1–5) *</label>
              <input type="range" min={1} max={5} className="w-full" value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: parseInt(e.target.value) })} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Low</span><span className="font-medium">{form.likelihood}</span><span>Critical</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Impact (1–5) *</label>
              <input type="range" min={1} max={5} className="w-full" value={form.impact} onChange={(e) => setForm({ ...form, impact: parseInt(e.target.value) })} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Low</span><span className="font-medium">{form.impact}</span><span>Critical</span></div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Risk score preview</label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{form.likelihood * form.impact}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${riskLevel(form.likelihood * form.impact).cls}`}>{riskLevel(form.likelihood * form.impact).label}</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Mitigation plan</label>
              <textarea className="w-full border rounded px-3 py-2 text-sm bg-background" rows={2} value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} placeholder="Implement MFA, enforce password rotation…" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save risk"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && risks.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No risks recorded</p>
          <p className="text-sm">Conduct and document risk assessments per §164.308(a)(1).</p>
        </div>
      )}
      {!loading && risks.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Risk</th>
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Level</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Update</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => {
                const level = riskLevel(r.risk_score);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.threat}</p>
                    </td>
                    <td className="p-3 font-bold text-lg">{r.risk_score}</td>
                    <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded ${level.cls}`}>{level.label}</span></td>
                    <td className="p-3"><StatusChip status={r.status} /></td>
                    <td className="p-3">
                      <select className="border rounded px-2 py-1 text-xs bg-background" value={r.status} onChange={(e) => handleStatusChange(r.id, e.target.value)}>
                        <option value="open">Open</option>
                        <option value="mitigated">Mitigated</option>
                        <option value="accepted">Accepted</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
