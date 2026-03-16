"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type TrainingRecord = {
  id: string;
  user_email: string;
  course_name: string;
  due_at: string;
  completed_at: string | null;
  status: "completed" | "overdue" | "pending";
  created_at: string;
};


function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    overdue: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${styles[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>
  );
}

export default function TrainingPage() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [tab, setTab] = useState<"all" | "overdue">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_email: "",
    course_name: "HIPAA Security Awareness Training",
    due_at: "",
    completed_at: "",
    status: "pending" as "pending" | "completed" | "overdue",
  });

  const load = () => {
    setLoading(true);
    const url = tab === "overdue" ? "/api/v1/hipaa/training/overdue" : "/api/v1/hipaa/training";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setRecords(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/hipaa/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          completed_at: form.completed_at || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowForm(false);
      setForm({ user_email: "", course_name: "HIPAA Security Awareness Training", due_at: "", completed_at: "", status: "pending" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const overdue = records.filter((r) => r.status === "overdue" || (r.status !== "completed" && r.due_at < new Date().toISOString().split("T")[0]));
  const display = tab === "overdue" ? records : records;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Workforce Training Records</h1>
        <p className="text-muted-foreground text-sm">§164.308(a)(5) — Security awareness and training program</p>
      </header>

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button onClick={() => setTab("all")} className={`px-3 py-1.5 text-sm rounded-md ${tab === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            All ({records.length})
          </button>
          <button onClick={() => setTab("overdue")} className={`px-3 py-1.5 text-sm rounded-md ${tab === "overdue" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            Overdue
          </button>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Add Record"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">New training record</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">User email *</label>
              <input required type="email" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Course name *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due date *</label>
              <input required type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Completed date</label>
              <input type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.completed_at} onChange={(e) => setForm({ ...form, completed_at: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "pending" | "completed" | "overdue" })}>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save record"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && display.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">{tab === "overdue" ? "No overdue training" : "No training records"}</p>
          <p className="text-sm">{tab === "overdue" ? "All workforce training is up to date." : "Add training records for workforce HIPAA awareness."}</p>
        </div>
      )}
      {!loading && display.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Course</th>
                <th className="text-left p-3">Due</th>
                <th className="text-left p-3">Completed</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r) => (
                <tr key={r.id} className={`border-t hover:bg-muted/20 ${r.status === "overdue" ? "bg-red-50/30 dark:bg-red-900/10" : ""}`}>
                  <td className="p-3">{r.user_email}</td>
                  <td className="p-3 text-muted-foreground">{r.course_name}</td>
                  <td className="p-3 text-muted-foreground">{r.due_at}</td>
                  <td className="p-3 text-muted-foreground">{r.completed_at ?? "—"}</td>
                  <td className="p-3"><StatusChip status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
