"use client";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PBCItem = {
  id: string;
  title: string;
  status: "open" | "in_review" | "fulfilled" | "rejected";
  description?: string;
  s3_key?: string;
  fulfilled_at?: string;
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  in_review: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  fulfilled: "bg-green-500/20 text-green-600 dark:text-green-400",
  rejected: "bg-red-500/20 text-red-600 dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_review: "In Review",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
};

export default function AuditorWorkspaceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const isAuditor = user?.role === "auditor";

  const [items, setItems] = useState<PBCItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [pbcForm, setPbcForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingItemId = useRef<string | null>(null);

  const listUrl = isAuditor
    ? `/api/v1/auditor/portal/workspaces/${id}/pbc`
    : `/api/v1/auditor/workspaces/${id}/pbc`;

  const load = () => {
    setLoading(true);
    apiFetch(listUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (id) load(); }, [id, isAuditor]);

  const handleCreatePbc = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/auditor/workspaces/${id}/pbc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pbcForm.title,
          description: pbcForm.description || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setShowCreate(false);
      setPbcForm({ title: "", description: "" });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/v1/auditor/workspaces/${id}/pbc/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const triggerUpload = (itemId: string) => {
    pendingItemId.current = itemId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = pendingItemId.current;
    if (!file || !itemId) return;
    e.target.value = "";
    setUploadingId(itemId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch(
        `/api/v1/auditor/portal/workspaces/${id}/pbc/${itemId}/fulfill`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploadingId(null);
      pendingItemId.current = null;
    }
  };

  const handleDownload = async (itemId: string) => {
    try {
      const res = await apiFetch(
        `/api/v1/auditor/portal/workspaces/${id}/pbc/${itemId}/download`
      );
      if (!res.ok) throw new Error(await res.text());
      const { download_url } = await res.json();
      window.open(download_url, "_blank");
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="page-enter max-w-4xl">
      {/* Hidden file input for evidence upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/auditor"
            className="text-sm text-muted-foreground hover:text-foreground mb-1 inline-block"
          >
            ← Workspaces
          </Link>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">PBC Items</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAuditor
              ? "Upload evidence files to fulfill open requests."
              : "Provided By Client request list for this workspace."}
          </p>
        </div>
        {!isAuditor && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            + Add PBC Item
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
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No PBC items.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-medium">{item.title}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        STATUS_STYLES[item.status] ?? "bg-muted"
                      }`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.description ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.s3_key && (
                        <button
                          onClick={() => handleDownload(item.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          Download
                        </button>
                      )}
                      {(item.status === "open" || item.status === "in_review") && (
                        <button
                          onClick={() => triggerUpload(item.id)}
                          disabled={uploadingId === item.id}
                          className="text-xs font-medium bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          {uploadingId === item.id ? "Uploading…" : "Upload Evidence"}
                        </button>
                      )}
                      {!isAuditor && item.status === "in_review" && (
                        <>
                          <button
                            onClick={() => handleStatusChange(item.id, "fulfilled")}
                            className="text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30 px-2 py-1 rounded transition-colors"
                          >
                            Fulfill
                          </button>
                          <button
                            onClick={() => handleStatusChange(item.id, "rejected")}
                            className="text-xs font-medium bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 px-2 py-1 rounded transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create PBC item modal */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Add PBC Item</h2>
            <form onSubmit={handleCreatePbc} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Title *</label>
                <input
                  required
                  value={pbcForm.title}
                  onChange={(e) => setPbcForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Security policy document"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={pbcForm.description}
                  onChange={(e) => setPbcForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="What document or evidence is needed?"
                />
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
                  {saving ? "Adding…" : "Add Item"}
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
