"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type ContingencyRecord = {
  id: string;
  plan_type: "backup" | "dr" | "emergency_mode" | "testing" | "revision";
  description: string;
  test_date: string;
  result: "pass" | "fail" | "not_tested";
  s3_key: string | null;
  created_at: string;
};


const PLAN_TYPE_LABELS: Record<string, string> = {
  backup: "Data Backup",
  dr: "Disaster Recovery",
  emergency_mode: "Emergency Mode",
  testing: "Testing & Revision",
  revision: "Plan Revision",
};

function ResultChip({ result }: { result: string }) {
  const styles: Record<string, string> = {
    pass: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    fail: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    not_tested: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = { pass: "Pass", fail: "Fail", not_tested: "Not Tested" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[result] ?? "bg-muted text-muted-foreground"}`}>{labels[result] ?? result}</span>;
}

export default function ContingencyPage() {
  const [records, setRecords] = useState<ContingencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plan_type: "backup" as ContingencyRecord["plan_type"],
    description: "",
    test_date: new Date().toISOString().split("T")[0],
    result: "not_tested" as ContingencyRecord["result"],
  });

  const load = () => {
    setLoading(true);
    apiFetch("/api/v1/hipaa/contingency")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setRecords(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/hipaa/contingency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  const grouped = records.reduce((acc, r) => {
    if (!acc[r.plan_type]) acc[r.plan_type] = [];
    acc[r.plan_type].push(r);
    return acc;
  }, {} as Record<string, ContingencyRecord[]>);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Contingency Plan Evidence</h1>
        <p className="text-muted-foreground text-sm">§164.308(a)(7) — Backup, disaster recovery, and emergency mode operations</p>
      </header>

      {/* Summary cards per plan type */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(["backup", "dr", "emergency_mode", "testing", "revision"] as const).map((pt) => {
          const items = grouped[pt] ?? [];
          const latest = items[0];
          const result = latest?.result ?? "not_tested";
          return (
            <div key={pt} className="border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{PLAN_TYPE_LABELS[pt]}</p>
              <ResultChip result={result} />
              {latest && <p className="text-xs text-muted-foreground mt-1">{latest.test_date}</p>}
              {!latest && <p className="text-xs text-muted-foreground mt-1">No records</p>}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Add Evidence"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">New contingency evidence record</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Plan type *</label>
              <select className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.plan_type} onChange={(e) => setForm({ ...form, plan_type: e.target.value as ContingencyRecord["plan_type"] })}>
                {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Test date *</label>
              <input required type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea required className="w-full border rounded px-3 py-2 text-sm bg-background" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Quarterly backup restore test; all critical systems restored within RTO…" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Result</label>
              <select className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as ContingencyRecord["result"] })}>
                <option value="not_tested">Not Tested</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save record"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && records.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No contingency records</p>
          <p className="text-sm">Document backup tests, DR exercises, and plan revisions.</p>
        </div>
      )}
      {!loading && records.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Plan type</th>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Test date</th>
                <th className="text-left p-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{PLAN_TYPE_LABELS[r.plan_type]}</td>
                  <td className="p-3 text-muted-foreground">{r.description}</td>
                  <td className="p-3 text-muted-foreground">{r.test_date}</td>
                  <td className="p-3"><ResultChip result={r.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
