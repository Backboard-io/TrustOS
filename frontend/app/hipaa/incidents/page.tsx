"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type Incident = {
  id: string;
  title: string;
  description: string;
  phi_involved: boolean;
  discovered_at: string;
  reported_at: string | null;
  resolved_at: string | null;
  status: "open" | "investigating" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
  breach_notification_required: boolean;
  created_at: string;
};


const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  medium: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  low: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  investigating: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  resolved: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    phi_involved: false,
    discovered_at: new Date().toISOString().slice(0, 16),
    severity: "medium" as Incident["severity"],
    breach_notification_required: false,
  });

  const load = () => {
    setLoading(true);
    apiFetch("/api/v1/hipaa/incidents")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setIncidents(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/hipaa/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          discovered_at: new Date(form.discovered_at).toISOString(),
          status: "open",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const body: Record<string, unknown> = { status };
    if (status === "resolved") body.resolved_at = new Date().toISOString();
    await apiFetch(`/api/v1/hipaa/incidents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  const open = incidents.filter((i) => i.status === "open");
  const breachRequired = incidents.filter((i) => i.breach_notification_required && i.status !== "resolved");

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Incident Register</h1>
        <p className="text-muted-foreground text-sm">§164.308(a)(6) — Security incident procedures and response</p>
      </header>

      {(open.length > 0 || breachRequired.length > 0) && (
        <div className="flex gap-3 mb-6">
          {open.length > 0 && <span className="text-sm px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 font-medium">{open.length} open incident{open.length !== 1 ? "s" : ""}</span>}
          {breachRequired.length > 0 && <span className="text-sm px-3 py-1.5 rounded-full bg-red-600 text-white font-medium">⚠ {breachRequired.length} breach notification required</span>}
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Report Incident"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">Report security incident</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Unauthorized access to patient portal" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea required className="w-full border rounded px-3 py-2 text-sm bg-background" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Discovered at *</label>
              <input required type="datetime-local" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.discovered_at} onChange={(e) => setForm({ ...form, discovered_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity *</label>
              <select className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Incident["severity"] })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.phi_involved} onChange={(e) => setForm({ ...form, phi_involved: e.target.checked })} />
              PHI involved
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.breach_notification_required} onChange={(e) => setForm({ ...form, breach_notification_required: e.target.checked })} />
              Breach notification required
            </label>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save incident"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && incidents.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No incidents recorded</p>
          <p className="text-sm">Document and track all security incidents per §164.308(a)(6).</p>
        </div>
      )}
      {!loading && incidents.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Incident</th>
                <th className="text-left p-3">Severity</th>
                <th className="text-left p-3">PHI</th>
                <th className="text-left p-3">Breach</th>
                <th className="text-left p-3">Discovered</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className={`border-t hover:bg-muted/20 ${i.breach_notification_required && i.status !== "resolved" ? "bg-red-50/30 dark:bg-red-900/10" : ""}`}>
                  <td className="p-3">
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{i.description}</p>
                  </td>
                  <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${SEVERITY_STYLES[i.severity]}`}>{i.severity}</span></td>
                  <td className="p-3">{i.phi_involved ? <span className="text-xs font-medium text-red-600">Yes</span> : <span className="text-xs text-muted-foreground">No</span>}</td>
                  <td className="p-3">{i.breach_notification_required ? <span className="text-xs font-medium text-red-600">Required</span> : <span className="text-xs text-muted-foreground">No</span>}</td>
                  <td className="p-3 text-muted-foreground text-xs">{new Date(i.discovered_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <select className="border rounded px-2 py-1 text-xs bg-background" value={i.status} onChange={(e) => handleStatusChange(i.id, e.target.value)}>
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                    </select>
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
