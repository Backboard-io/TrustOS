"use client";

import { apiFetch, apiPost, apiPatch } from "@/lib/api";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { X, Plus, Pencil, Play, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Integration = {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  credentials_ref: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_run_id: string | null;
  last_run_status: string | null;
  last_run_at: string | null;
};

type FormState = {
  type: string;
  name: string;
  config_json: string;
  credentials_ref: string;
  enabled: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const INTEGRATION_TYPES = ["prowler", "steampipe", "checkov", "trivy", "cloudquery", "slack", "jira"];

const TYPE_META: Record<string, { label: string; badge: string; icon: string; desc: string; template: Record<string, unknown> }> = {
  prowler:    { label: "Prowler",     icon: "🛡️",  desc: "Cloud security posture",       badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", template: { provider: "aws", region: "us-east-1", checks: ["cis_level1"] } },
  steampipe:  { label: "Steampipe",   icon: "🔍",  desc: "SQL for cloud APIs",           badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",          template: { query_file: "queries/cis_aws.sql", plugin: "aws" } },
  checkov:    { label: "Checkov",     icon: "📋",  desc: "IaC security scanner",         badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",   template: { repo_path: ".", framework: "terraform" } },
  trivy:      { label: "Trivy",       icon: "🔬",  desc: "Container vulnerability scan", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",              template: { target: ".", scanners: ["vuln", "secret", "config"] } },
  cloudquery: { label: "CloudQuery",  icon: "☁️",  desc: "Cloud asset sync",             badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",       template: { provider: "aws", tables: ["aws_s3_buckets"] } },
  slack:      { label: "Slack",       icon: "💬",  desc: "Slack notifications",          badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",   template: { channel: "#security-alerts" } },
  jira:       { label: "Jira",        icon: "📌",  desc: "Jira issue tracking",          badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",               template: { project: "SEC", issue_type: "Task" } },
};

const STATUS_STYLE: Record<string, string> = {
  completed: "text-green-600 dark:text-green-400",
  running:   "text-blue-600 dark:text-blue-400",
  failed:    "text-red-600 dark:text-red-400",
  pending:   "text-yellow-600 dark:text-yellow-400",
};

const DEFAULT_FORM: FormState = {
  type: "prowler",
  name: "",
  config_json: JSON.stringify({ provider: "aws", region: "us-east-1", checks: ["cis_level1"] }, null, 2),
  credentials_ref: "",
  enabled: true,
};

// ── Toast ─────────────────────────────────────────────────────────────────────

type Toast = { id: number; msg: string; kind: "success" | "error" };

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
            cursor-pointer select-none
            animate-[slideUp_0.25s_ease-out]
            ${t.kind === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
            }
          `}
        >
          {t.kind === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
      <svg
        className="w-48 h-48 opacity-80"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ animation: "float 3s ease-in-out infinite" }}
      >
        {/* Server rack */}
        <rect x="40" y="60" width="120" height="20" rx="4" className="fill-muted stroke-muted-foreground/30" strokeWidth="1.5"/>
        <rect x="40" y="86" width="120" height="20" rx="4" className="fill-muted stroke-muted-foreground/30" strokeWidth="1.5"/>
        <rect x="40" y="112" width="120" height="20" rx="4" className="fill-muted stroke-muted-foreground/30" strokeWidth="1.5"/>
        {/* Status lights */}
        <circle cx="145" cy="70" r="4" className="fill-muted-foreground/20"/>
        <circle cx="155" cy="70" r="4" className="fill-muted-foreground/20"/>
        <circle cx="145" cy="96" r="4" className="fill-muted-foreground/20"/>
        <circle cx="155" cy="96" r="4" className="fill-muted-foreground/20"/>
        <circle cx="145" cy="122" r="4" className="fill-muted-foreground/20"/>
        <circle cx="155" cy="122" r="4" className="fill-muted-foreground/20"/>
        {/* Plug cable */}
        <path d="M100 138 Q100 158 80 165 Q60 172 60 185" className="stroke-muted-foreground/30" strokeWidth="2" strokeDasharray="4 3" fill="none"/>
        <circle cx="60" cy="188" r="5" className="fill-muted stroke-muted-foreground/40" strokeWidth="1.5"/>
        {/* Plus badge */}
        <circle cx="148" cy="52" r="16" className="fill-primary"/>
        <path d="M148 44 L148 60 M140 52 L156 52" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">No integrations yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Connect scanners, cloud providers, and notification tools to start pulling compliance data automatically.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
        >
          <Plus size={16} />
          Add Integration
        </button>
        <a
          href="https://docs.prowler.cloud"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          View docs ↗
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Or run <code className="font-mono bg-muted px-1.5 py-0.5 rounded">scripts/seed_integrations.py</code> to load sample data.
      </p>
    </div>
  );
}

// ── Integration Card ──────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  index,
  syncing,
  onEdit,
  onSync,
}: {
  integration: Integration;
  index: number;
  syncing: boolean;
  onEdit: () => void;
  onSync: () => void;
}) {
  const meta = TYPE_META[integration.type] ?? { label: integration.type, icon: "🔌", desc: "", badge: "bg-muted text-muted-foreground", template: {} };
  const statusStyle = integration.last_run_status ? STATUS_STYLE[integration.last_run_status] ?? "text-muted-foreground" : "";

  return (
    <div
      className="border rounded-xl p-5 flex justify-between items-start gap-4 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${index * 40}ms`, animation: "fadeSlideUp 0.3s ease-out both" }}
    >
      <div className="flex items-start gap-4 min-w-0">
        <div className="text-2xl select-none mt-0.5 shrink-0">{meta.icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base leading-tight truncate">{integration.name}</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
              {meta.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              integration.enabled
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}>
              {integration.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{meta.desc}</p>
          {integration.last_run_at && (
            <p className={`text-xs mt-1.5 flex items-center gap-1 ${statusStyle}`}>
              <Clock size={11} />
              {new Date(integration.last_run_at).toLocaleString()} — {integration.last_run_status}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {integration.last_run_id && (
          <Link
            href={`/runs/${integration.last_run_id}`}
            className="text-xs text-primary hover:underline px-2 py-1.5 rounded hover:bg-primary/5 transition-colors"
          >
            View run
          </Link>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="p-2 rounded-lg border hover:bg-muted active:scale-[0.95] transition-all"
          title="Edit integration"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onSync}
          disabled={!integration.enabled || syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-40 hover:opacity-90 active:scale-[0.97] transition-all"
        >
          {syncing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {syncing ? "Starting…" : "Run now"}
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function IntegrationModal({
  mode,
  initial,
  onSave,
  onClose,
  saving,
  error,
}: {
  mode: "create" | "edit";
  initial: FormState;
  onSave: (form: FormState) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // When type changes, offer a config template if config is still at default/empty
  function handleTypeChange(type: string) {
    const template = TYPE_META[type]?.template ?? {};
    const currentIsDefault = form.config_json.trim() === "{}" || form.config_json.trim() === "";
    setForm((f) => ({
      ...f,
      type,
      config_json: currentIsDefault ? JSON.stringify(template, null, 2) : f.config_json,
    }));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ animation: "fadeIn 0.15s ease-out" }}
      onClick={handleBackdrop}
    >
      <div
        className="bg-background border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ animation: "slideUp 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "create" ? "Add Integration" : "Edit Integration"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "create" ? "Connect a new data source or notification tool." : "Update configuration and settings."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {INTEGRATION_TYPES.map((t) => {
                const m = TYPE_META[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all active:scale-[0.97] ${
                      form.type === t
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="leading-tight">
                      <span className="block text-xs font-medium">{m.label}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">{m.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="int-name">Name</label>
            <input
              id="int-name"
              ref={nameRef}
              type="text"
              required
              placeholder={`e.g. Prowler — AWS Production`}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>

          {/* Config JSON */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="int-config">
              Config <span className="text-muted-foreground font-normal">(JSON)</span>
            </label>
            <textarea
              id="int-config"
              rows={6}
              value={form.config_json}
              onChange={(e) => set("config_json", e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
              spellCheck={false}
            />
          </div>

          {/* Credentials ref */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="int-creds">
              Credentials ref <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="int-creds"
              type="text"
              placeholder="e.g. aws-prod-creds"
              value={form.credentials_ref}
              onChange={(e) => set("credentials_ref", e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Disabled integrations cannot be run.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              onClick={() => set("enabled", !form.enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                form.enabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  form.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted active:scale-[0.97] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : mode === "create" ? "Add Integration" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<{ mode: "create" | "edit"; initial: FormState; editId?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  function toast(msg: string, kind: Toast["kind"] = "success") {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  const load = useCallback(() => {
    apiFetch("/api/v1/integrations")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setIntegrations)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setModalError(null);
    setModal({ mode: "create", initial: DEFAULT_FORM });
  }

  function openEdit(integration: Integration) {
    setModalError(null);
    setModal({
      mode: "edit",
      editId: integration.id,
      initial: {
        type: integration.type,
        name: integration.name,
        config_json: JSON.stringify(integration.config ?? {}, null, 2),
        credentials_ref: integration.credentials_ref ?? "",
        enabled: integration.enabled,
      },
    });
  }

  async function handleSave(form: FormState) {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(form.config_json || "{}");
    } catch {
      setModalError("Config JSON is invalid. Please fix it before saving.");
      return;
    }

    const body = {
      type: form.type,
      name: form.name.trim(),
      config,
      credentials_ref: form.credentials_ref.trim() || null,
      enabled: form.enabled,
    };

    setSaving(true);
    setModalError(null);
    try {
      if (modal?.mode === "create") {
        const created = await apiPost<Integration>("/api/v1/integrations", body);
        setIntegrations((prev) => [created, ...prev]);
        toast(`${form.name} added successfully`);
      } else if (modal?.mode === "edit" && modal.editId) {
        const updated = await apiPatch<Integration>(`/api/v1/integrations/${modal.editId}`, body);
        setIntegrations((prev) => prev.map((i) => (i.id === modal.editId ? updated : i)));
        toast(`${form.name} updated`);
      }
      setModal(null);
    } catch (e) {
      setModalError(String(e).replace("Error: ", ""));
    } finally {
      setSaving(false);
    }
  }

  async function triggerSync(id: string) {
    setSyncing(id);
    try {
      const r = await apiFetch(`/api/v1/integrations/${id}/sync`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (data.run_id) {
        toast("Run started — redirecting…");
        setTimeout(() => { window.location.href = `/runs/${data.run_id}`; }, 800);
      } else {
        toast("Run started");
        load();
      }
    } catch (e) {
      toast(String(e).replace("Error: ", ""), "error");
    } finally {
      setSyncing(null);
    }
  }

  const enabledCount = integrations.filter((i) => i.enabled).length;

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
      `}</style>

      <div className="min-h-screen p-6 max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b pb-5 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Integrations</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loading
                ? "Loading integrations…"
                : integrations.length === 0
                  ? "No integrations configured yet."
                  : `${integrations.length} integration${integrations.length !== 1 ? "s" : ""} · ${enabledCount} enabled`
              }
            </p>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all shrink-0"
            >
              <Plus size={16} />
              Add Integration
            </button>
          )}
        </header>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-xl p-5 h-20 animate-pulse bg-muted/40" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && integrations.length === 0 && (
          <EmptyState onAdd={openCreate} />
        )}

        {/* Integration list */}
        {!loading && integrations.length > 0 && (
          <div className="space-y-3">
            {integrations.map((integration, i) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                index={i}
                syncing={syncing === integration.id}
                onEdit={() => openEdit(integration)}
                onSync={() => triggerSync(integration.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <IntegrationModal
          mode={modal.mode}
          initial={modal.initial}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
          error={modalError}
        />
      )}

      {/* Toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
