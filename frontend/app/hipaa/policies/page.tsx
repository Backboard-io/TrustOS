"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type PolicyAck = {
  id: string;
  policy_name: string;
  policy_version: string;
  user_email: string;
  acknowledged_at: string;
  next_due_at: string;
  created_at: string;
};


const COMMON_POLICIES = [
  "HIPAA Security Policy",
  "Information Access Management Policy",
  "Workforce Security Policy",
  "Incident Response Policy",
  "Contingency Plan Policy",
  "Device and Media Controls Policy",
  "Audit Controls Policy",
];

export default function PoliciesPage() {
  const [acks, setAcks] = useState<PolicyAck[]>([]);
  const [filterPolicy, setFilterPolicy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    policy_name: "HIPAA Security Policy",
    policy_version: "1.0",
    user_email: "",
    acknowledged_at: new Date().toISOString().slice(0, 16),
    next_due_at: "",
  });

  const load = () => {
    setLoading(true);
    const q = filterPolicy ? `?policy_name=${encodeURIComponent(filterPolicy)}` : "";
    apiFetch(`/api/v1/hipaa/policies${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setAcks(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterPolicy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/hipaa/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          acknowledged_at: new Date(form.acknowledged_at).toISOString(),
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

  const today = new Date().toISOString().split("T")[0];
  const overdue = acks.filter((a) => a.next_due_at < today);

  // Group by policy name
  const byPolicy = acks.reduce((acc, a) => {
    if (!acc[a.policy_name]) acc[a.policy_name] = [];
    acc[a.policy_name].push(a);
    return acc;
  }, {} as Record<string, PolicyAck[]>);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Policy Acknowledgements</h1>
        <p className="text-muted-foreground text-sm">§164.316 — Policies and procedures documentation and acknowledgement tracking</p>
      </header>

      {overdue.length > 0 && (
        <div className="mb-6">
          <span className="text-sm px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
            {overdue.length} policy acknowledgement{overdue.length !== 1 ? "s" : ""} past due
          </span>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <select className="border rounded px-2 py-1.5 text-sm bg-background" value={filterPolicy} onChange={(e) => setFilterPolicy(e.target.value)}>
          <option value="">All policies</option>
          {COMMON_POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Add Acknowledgement"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">Record policy acknowledgement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Policy name *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" list="policy-list" value={form.policy_name} onChange={(e) => setForm({ ...form, policy_name: e.target.value })} />
              <datalist id="policy-list">{COMMON_POLICIES.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Policy version *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.policy_version} onChange={(e) => setForm({ ...form, policy_version: e.target.value })} placeholder="1.0" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">User email *</label>
              <input required type="email" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Acknowledged at *</label>
              <input required type="datetime-local" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.acknowledged_at} onChange={(e) => setForm({ ...form, acknowledged_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Next due date *</label>
              <input required type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.next_due_at} onChange={(e) => setForm({ ...form, next_due_at: e.target.value })} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save acknowledgement"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && acks.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No acknowledgements recorded</p>
          <p className="text-sm">Track workforce policy acknowledgements for HIPAA compliance.</p>
        </div>
      )}

      {!loading && acks.length > 0 && Object.keys(byPolicy).length > 0 && !filterPolicy && (
        <div className="space-y-6">
          {Object.entries(byPolicy).map(([policyName, policyAcks]) => {
            const overdueCount = policyAcks.filter((a) => a.next_due_at < today).length;
            return (
              <section key={policyName}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium">{policyName}</h3>
                  {overdueCount > 0 && <span className="text-xs text-amber-600 font-medium">{overdueCount} overdue</span>}
                  <span className="text-xs text-muted-foreground">{policyAcks.length} acknowledgement{policyAcks.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3">User</th>
                        <th className="text-left p-3">Version</th>
                        <th className="text-left p-3">Acknowledged</th>
                        <th className="text-left p-3">Next due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policyAcks.map((a) => {
                        const isOverdue = a.next_due_at < today;
                        return (
                          <tr key={a.id} className={`border-t hover:bg-muted/20 ${isOverdue ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                            <td className="p-3">{a.user_email}</td>
                            <td className="p-3 text-muted-foreground">{a.policy_version}</td>
                            <td className="p-3 text-muted-foreground">{new Date(a.acknowledged_at).toLocaleDateString()}</td>
                            <td className={`p-3 text-sm font-medium ${isOverdue ? "text-amber-600" : "text-muted-foreground"}`}>
                              {a.next_due_at}{isOverdue ? " ⚠" : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!loading && acks.length > 0 && filterPolicy && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Version</th>
                <th className="text-left p-3">Acknowledged</th>
                <th className="text-left p-3">Next due</th>
              </tr>
            </thead>
            <tbody>
              {acks.map((a) => {
                const isOverdue = a.next_due_at < today;
                return (
                  <tr key={a.id} className={`border-t hover:bg-muted/20 ${isOverdue ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                    <td className="p-3">{a.user_email}</td>
                    <td className="p-3 text-muted-foreground">{a.policy_version}</td>
                    <td className="p-3 text-muted-foreground">{new Date(a.acknowledged_at).toLocaleDateString()}</td>
                    <td className={`p-3 ${isOverdue ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>{a.next_due_at}{isOverdue ? " ⚠" : ""}</td>
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
