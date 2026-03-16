"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type PolicyStatus = "pending" | "approved" | "rejected";

type PolicyRequest = {
  id: string;
  policy_id: string;
  version_id: string;
  title: string;
  status: PolicyStatus;
  submitted_at: string;
  approved_at?: string;
  rejected_at?: string;
};

type HistoryEntry = {
  approver_email: string;
  decision: "approved" | "rejected";
  comment?: string;
  decided_at: string;
};

function StatusBadge({ status }: { status: PolicyStatus }) {
  const map: Record<PolicyStatus, string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  };
  const icons: Record<PolicyStatus, string> = { pending: "⏳", approved: "✓", rejected: "✕" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      <span className="text-[10px]">{icons[status]}</span> {status}
    </span>
  );
}

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-[pageEnter_0.2s_ease_both] ${
      type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"
    }`}>
      {type === "success" ? "✓" : "✕"} {msg}
      <button onClick={onDismiss} className="ml-1 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

export default function WorkflowsPoliciesPage() {
  const [requests, setRequests] = useState<PolicyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", policy_id: "", version_id: "", s3_key: "" });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [deciding, setDeciding] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => setToast({ msg, type });

  function load() {
    setLoading(true);
    apiFetch("/api/v1/workflows/policies")
      .then((r) => r.ok ? r.json() : [])
      .then(setRequests)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await apiFetch("/api/v1/workflows/policies", { method: "POST", body: JSON.stringify(form) });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      const req: PolicyRequest = await r.json();
      setRequests((prev) => [req, ...prev]);
      setForm({ title: "", policy_id: "", version_id: "", s3_key: "" });
      setShowForm(false);
      showToast("Policy approval request submitted", "success");
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function expandRequest(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setHistory([]);
    setHistLoading(true);
    const r = await apiFetch(`/api/v1/workflows/policies/${id}/history`);
    setHistory(r.ok ? await r.json() : []);
    setHistLoading(false);
  }

  async function decide(requestId: string, action: "approve" | "reject") {
    setDeciding({ id: requestId, action });
  }

  async function confirmDecision() {
    if (!deciding) return;
    const { id, action } = deciding;
    try {
      const r = await apiFetch(`/api/v1/workflows/policies/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ decision: action === "approve" ? "approved" : "rejected", comment: comment || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      setRequests((prev) => prev.map((req) =>
        req.id === id ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req
      ));
      setDeciding(null);
      setComment("");
      showToast(`Policy ${action === "approve" ? "approved" : "rejected"}`, "success");
      if (expanded === id) {
        const hr = await apiFetch(`/api/v1/workflows/policies/${id}/history`);
        setHistory(hr.ok ? await hr.json() : []);
      }
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
      setDeciding(null);
    }
  }

  const isEmpty = !loading && requests.length === 0;
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="page-enter max-w-5xl">
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Decision confirmation modal */}
      {deciding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[pageEnter_0.15s_ease_both]">
          <div className="bg-[hsl(var(--card-bg))] rounded-xl border border-border p-6 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-1 capitalize">{deciding.action} Policy?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {deciding.action === "approve"
                ? "This will mark the policy as approved. The decision is recorded with your account."
                : "This will reject the policy. The submitter will need to resubmit."}
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment (optional)…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDecision}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white active:scale-[0.97] transition-all ${
                  deciding.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:opacity-90"
                }`}
              >
                Confirm {deciding.action}
              </button>
              <button onClick={() => { setDeciding(null); setComment(""); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/workflows" className="text-sm text-muted-foreground hover:text-foreground mb-1 inline-block transition-colors">← Workflows</Link>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Policy Approvals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Policy version approval chains — SOC 2 CC1.3–1.4 · HIPAA §164.316
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
              {pendingCount} pending
            </span>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Submit Policy
          </button>
        </div>
      </header>

      {/* Create form */}
      {showForm && (
        <form onSubmit={submitRequest} className="mb-6 rounded-xl border border-border bg-[hsl(var(--card-bg))] p-5 animate-[pageEnter_0.2s_ease_both]">
          <h2 className="text-sm font-semibold mb-1">Submit Policy for Approval</h2>
          <p className="text-xs text-muted-foreground mb-4">Creates an approval request that must be reviewed and approved by an authorized approver.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Policy title *</label>
              <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Access Control Policy v2.1" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Policy ID *</label>
              <input required value={form.policy_id} onChange={(e) => setForm((f) => ({ ...f, policy_id: e.target.value }))} placeholder="access-control-policy" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Version ID *</label>
              <input required value={form.version_id} onChange={(e) => setForm((f) => ({ ...f, version_id: e.target.value }))} placeholder="v2.1" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">S3 document key *</label>
              <input required value={form.s3_key} onChange={(e) => setForm((f) => ({ ...f, s3_key: e.target.value }))} placeholder="policies/access-control-policy-v2.1.pdf" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all">
              {saving ? "Submitting…" : "Submit for Approval"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {loading && <p className="text-muted-foreground animate-pulse">Loading…</p>}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28 mb-6 opacity-40">
            <rect x="20" y="10" width="80" height="80" rx="6" stroke="currentColor" strokeWidth="2" />
            <path d="M35 35h50M35 50h50M35 65h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="90" cy="72" r="16" fill="hsl(var(--card-bg))" stroke="currentColor" strokeWidth="2" />
            <path d="M84 72l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-lg font-medium mb-1">No policy requests yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Every policy version needs an approved decision trail. SOC 2 and HIPAA require documented, approved policies.
          </p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            Submit First Policy
          </button>
        </div>
      )}

      {/* Request list */}
      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="rounded-xl border border-border bg-[hsl(var(--card-bg))] overflow-hidden transition-all">
            <div className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{req.title}</span>
                  <StatusBadge status={req.status} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono">{req.policy_id}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{req.version_id}</span>
                  <span className="text-xs text-muted-foreground">· submitted {new Date(req.submitted_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {req.status === "pending" && (
                  <>
                    <button
                      onClick={() => decide(req.id, "approve")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors active:scale-[0.97]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(req.id, "reject")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors active:scale-[0.97]"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => expandRequest(req.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.97] ${
                    expanded === req.id ? "bg-muted border-border" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {expanded === req.id ? "Hide" : "History"}
                </button>
              </div>
            </div>

            {/* History panel */}
            {expanded === req.id && (
              <div className="border-t border-border bg-muted/20 px-4 py-3 animate-[pageEnter_0.2s_ease_both]">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Decision History</p>
                {histLoading && <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>}
                {!histLoading && history.length === 0 && (
                  <p className="text-xs text-muted-foreground">No decisions recorded yet.</p>
                )}
                {!histLoading && history.length > 0 && (
                  <div className="space-y-1.5">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <span className={`mt-0.5 px-1.5 py-0.5 rounded font-medium ${
                          h.decision === "approved" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
                        }`}>{h.decision}</span>
                        <span className="text-muted-foreground">{h.approver_email}</span>
                        <span className="text-muted-foreground/60">{new Date(h.decided_at).toLocaleString()}</span>
                        {h.comment && <span className="text-muted-foreground/60 italic">"{h.comment}"</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
