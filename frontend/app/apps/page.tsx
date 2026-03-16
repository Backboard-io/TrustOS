"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, type AppRead } from "@/contexts/AuthContext";
import { apiDelete, apiGet, apiPost } from "@/lib/api";

export default function AppsPage() {
  const { user, selectApp } = useAuth();
  const router = useRouter();

  const [apps, setApps] = useState<AppRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<AppRead[]>("/api/v1/apps")
      .then(setApps)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const app = await apiPost<AppRead>("/api/v1/apps", {
        name: newName.trim(),
        description: newDesc.trim(),
      });
      setApps((prev) => [app, ...prev]);
      setNewName("");
      setNewDesc("");
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create app");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(app: AppRead) {
    if (!confirm(`Delete "${app.name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/v1/apps/${app.id}`);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete app");
    }
  }

  function handleSelect(app: AppRead) {
    selectApp(app);
    router.push("/");
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Your apps</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Each app is an isolated compliance workspace with its own data.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-bb-blue text-white text-sm font-medium hover:bg-bb-blue/90 transition-colors"
          >
            + New app
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-rose-500 bg-rose-500/10 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        {/* Create form */}
        {showForm && (
          <div className="mb-6 rounded-xl border border-border bg-[hsl(var(--card-bg))] p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">New app</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                required
                maxLength={100}
                placeholder="App name (e.g. Acme Corp SOC 2)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bb-blue/50 focus:border-bb-blue transition-colors"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bb-blue/50 focus:border-bb-blue transition-colors"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-bb-blue text-white text-sm font-medium hover:bg-bb-blue/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* App list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-border bg-muted/20 animate-pulse"
              />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-base font-medium mb-1">No apps yet</p>
            <p className="text-sm">Create your first compliance workspace above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="group flex items-center justify-between rounded-xl border border-border bg-[hsl(var(--card-bg))] px-5 py-4 hover:border-bb-blue/40 transition-colors cursor-pointer"
                onClick={() => handleSelect(app)}
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{app.name}</p>
                  {app.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {app.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    Created {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs text-bb-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Open →
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(app);
                    }}
                    className="text-xs text-muted-foreground/50 hover:text-rose-400 transition-colors px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
