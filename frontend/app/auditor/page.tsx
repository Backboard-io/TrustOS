"use client";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Workspace = {
  id: string;
  name: string;
  description?: string;
  auditor_emails: string[];
};

export default function AuditorPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", auditor_emails: "" });
  const [saving, setSaving] = useState(false);

  const isAuditor = user?.role === "auditor";
  const listUrl = isAuditor ? "/api/v1/auditor/portal/workspaces" : "/api/v1/auditor/workspaces";

  const load = () => {
    setLoading(true);
    apiFetch(listUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setWorkspaces)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [isAuditor]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/auditor/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          auditor_emails: form.auditor_emails
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setWorkspaces((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm({ name: "", description: "", auditor_emails: "" });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter max-w-4xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Auditor {isAuditor ? "Portal" : "Workspaces"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAuditor
              ? "View PBC requests and upload evidence."
              : "Manage auditor workspaces and PBC request lists."}
          </p>
        </div>
        {!isAuditor && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            + New Workspace
          </button>
        )}
      </header>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">Error: {error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-border bg-[hsl(var(--card-bg))] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Description</th>
                {!isAuditor && <th className="text-left p-3 font-medium">Auditors</th>}
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.length === 0 && (
                <tr>
                  <td colSpan={isAuditor ? 3 : 4} className="p-6 text-center text-muted-foreground">
                    No workspaces.
                  </td>
                </tr>
              )}
              {workspaces.map((w) => (
                <tr key={w.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-medium">{w.name}</td>
                  <td className="p-3 text-muted-foreground">{w.description ?? "—"}</td>
                  {!isAuditor && (
                    <td className="p-3 text-muted-foreground text-xs">
                      {w.auditor_emails?.join(", ") || "—"}
                    </td>
                  )}
                  <td className="p-3">
                    <Link
                      href={`/auditor/${w.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View PBC
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create workspace modal */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New Workspace</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Q1 2025 SOC 2 Audit"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Auditor Emails</label>
                <input
                  value={form.auditor_emails}
                  onChange={(e) => setForm((f) => ({ ...f, auditor_emails: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="auditor@firm.com, partner@firm.com"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
