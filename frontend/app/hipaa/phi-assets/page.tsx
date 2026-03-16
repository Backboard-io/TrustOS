"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type PHIAsset = {
  id: string;
  name: string;
  description: string | null;
  data_classification: string;
  system_owner: string;
  location: string;
  encryption_at_rest: boolean;
  encryption_in_transit: boolean;
  retention_period_days: number | null;
  created_at: string;
};


function Chip({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ok ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"}`}>
      {ok ? "Yes" : "No"}
    </span>
  );
}

export default function PHIAssetsPage() {
  const [assets, setAssets] = useState<PHIAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    data_classification: "ePHI",
    system_owner: "",
    location: "",
    encryption_at_rest: false,
    encryption_in_transit: false,
    retention_period_days: "",
  });

  const load = () => {
    setLoading(true);
    apiFetch("/api/v1/hipaa/phi-assets")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setAssets(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        retention_period_days: form.retention_period_days ? parseInt(form.retention_period_days) : null,
      };
      const res = await apiFetch("/api/v1/hipaa/phi-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowForm(false);
      setForm({ name: "", description: "", data_classification: "ePHI", system_owner: "", location: "", encryption_at_rest: false, encryption_in_transit: false, retention_period_days: "" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this PHI asset?")) return;
    await apiFetch(`/api/v1/hipaa/phi-assets/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">PHI Asset Inventory</h1>
        <p className="text-muted-foreground text-sm">Electronic protected health information data sources and systems</p>
      </header>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{assets.length} asset{assets.length !== 1 ? "s" : ""} registered</p>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Add Asset"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">New PHI asset</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Patient records database" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Classification *</label>
              <select className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.data_classification} onChange={(e) => setForm({ ...form, data_classification: e.target.value })}>
                <option>ePHI</option><option>PHI</option><option>PII</option><option>Confidential</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">System owner *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.system_owner} onChange={(e) => setForm({ ...form, system_owner: e.target.value })} placeholder="eng-team@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="AWS RDS us-east-1" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Retention period (days)</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.retention_period_days} onChange={(e) => setForm({ ...form, retention_period_days: e.target.value })} placeholder="2555" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.encryption_at_rest} onChange={(e) => setForm({ ...form, encryption_at_rest: e.target.checked })} />
              Encrypted at rest
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.encryption_in_transit} onChange={(e) => setForm({ ...form, encryption_in_transit: e.target.checked })} />
              Encrypted in transit
            </label>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save asset"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && assets.length === 0 && !showForm && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No PHI assets registered</p>
          <p className="text-sm">Add systems and data stores that process or store ePHI.</p>
        </div>
      )}
      {!loading && assets.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Classification</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3">Enc. at rest</th>
                <th className="text-left p-3">Enc. in transit</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{a.name}</td>
                  <td className="p-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{a.data_classification}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{a.system_owner}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{a.location}</td>
                  <td className="p-3"><Chip ok={a.encryption_at_rest} /></td>
                  <td className="p-3"><Chip ok={a.encryption_in_transit} /></td>
                  <td className="p-3">
                    <button onClick={() => handleDelete(a.id)} className="text-xs text-muted-foreground hover:text-destructive">Delete</button>
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
