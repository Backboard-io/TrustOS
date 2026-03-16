"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type CampaignStatus = "draft" | "active" | "closed";
type AttestationOutcome = "approved" | "revoked" | "no_change";

type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  recurrence: string;
  description?: string;
  due_at?: string;
  closed_at?: string;
};

type Attestation = {
  id: string;
  reviewer_email: string;
  subject_id: string;
  subject_type: string;
  outcome: AttestationOutcome;
  comment?: string;
  attested_at: string;
};

type CampaignResult = {
  total_subjects: number;
  attested_count: number;
  approved_count: number;
  revoked_count: number;
  no_change_count: number;
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    closed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />}
      {status}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: AttestationOutcome }) {
  const map: Record<AttestationOutcome, string> = {
    approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    revoked: "bg-red-500/10 text-red-700 dark:text-red-400",
    no_change: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[outcome]}`}>
      {outcome.replace("_", " ")}
    </span>
  );
}

function Toast({ msg, type, onDismiss }: { msg: string; type: "success" | "error"; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-[pageEnter_0.2s_ease_both] ${
      type === "success" ? "bg-emerald-600 text-white" : "bg-destructive text-white"
    }`}>
      {type === "success" ? "✓" : "✕"} {msg}
      <button onClick={onDismiss} className="ml-1 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

export default function WorkflowsAccessReviewsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", recurrence: "quarterly", due_at: "" });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attForm, setAttForm] = useState({ reviewer_email: "", subject_id: "", subject_type: "user", outcome: "approved" as AttestationOutcome, comment: "" });
  const [attSaving, setAttSaving] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => setToast({ msg, type });

  function load() {
    setLoading(true);
    apiFetch("/api/v1/workflows/campaigns")
      .then((r) => r.ok ? r.json() : [])
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = { name: form.name, recurrence: form.recurrence };
      if (form.description) body.description = form.description;
      if (form.due_at) body.due_at = form.due_at;
      const r = await apiFetch("/api/v1/workflows/campaigns", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      const campaign = await r.json();
      setCampaigns((prev) => [campaign, ...prev]);
      setForm({ name: "", description: "", recurrence: "quarterly", due_at: "" });
      setShowForm(false);
      showToast("Campaign created", "success");
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function expandCampaign(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setAttLoading(true);
    const [attR, resR] = await Promise.all([
      apiFetch(`/api/v1/workflows/campaigns/${id}/attestations`),
      apiFetch(`/api/v1/workflows/campaigns/${id}/result`),
    ]);
    setAttestations(attR.ok ? await attR.json() : []);
    setResult(resR.ok ? await resR.json() : null);
    setAttLoading(false);
  }

  async function submitAttestation(e: React.FormEvent, campaignId: string) {
    e.preventDefault();
    setAttSaving(true);
    try {
      const r = await apiFetch(`/api/v1/workflows/campaigns/${campaignId}/attest`, {
        method: "POST",
        body: JSON.stringify({ ...attForm }),
      });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      const att: Attestation = await r.json();
      setAttestations((prev) => [att, ...prev]);
      setAttForm({ reviewer_email: "", subject_id: "", subject_type: "user", outcome: "approved", comment: "" });
      showToast("Attestation recorded", "success");
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setAttSaving(false);
    }
  }

  async function closeCampaign(id: string) {
    setClosing(id);
    try {
      const r = await apiFetch(`/api/v1/workflows/campaigns/${id}/close`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "closed" } : c));
      showToast("Campaign closed", "success");
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setClosing(null);
    }
  }

  async function activateCampaign(id: string) {
    const r = await apiFetch(`/api/v1/workflows/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    if (r.ok) {
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "active" } : c));
      showToast("Campaign activated", "success");
    }
  }

  const isEmpty = !loading && campaigns.length === 0;

  return (
    <div className="page-enter max-w-5xl">
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/workflows" className="text-sm text-muted-foreground hover:text-foreground mb-1 inline-block transition-colors">← Workflows</Link>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Access Reviews</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recurring access certifications — SOC 2 CC6.2, CC6.6 · HIPAA §164.308(a)(3)(ii)(B)
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New Campaign
        </button>
      </header>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={createCampaign}
          className="mb-6 rounded-xl border border-border bg-[hsl(var(--card-bg))] p-5 animate-[pageEnter_0.2s_ease_both]"
        >
          <h2 className="text-sm font-semibold mb-4">New Access Review Campaign</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Campaign name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Q2 2026 Access Review"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Recurrence</label>
              <select
                value={form.recurrence}
                onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="biannual">Biannual</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Due date</label>
              <input
                type="date"
                value={form.due_at}
                onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Scope or notes…"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all"
            >
              {saving ? "Creating…" : "Create Campaign"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {loading && <p className="text-muted-foreground animate-pulse">Loading…</p>}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28 mb-6 opacity-40">
            <rect x="15" y="15" width="90" height="70" rx="8" stroke="currentColor" strokeWidth="2" />
            <path d="M35 40h50M35 55h30M35 70h40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="90" cy="65" r="15" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M85 65l3 3 6-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-lg font-medium mb-1">No campaigns yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Quarterly access reviews are required by SOC 2 CC6.2 and HIPAA. Create your first campaign to start collecting reviewer attestations.
          </p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            Create First Campaign
          </button>
        </div>
      )}

      {/* Campaign list */}
      <div className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-[hsl(var(--card-bg))] overflow-hidden transition-all">
            <div className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{c.name}</span>
                  <StatusBadge status={c.status} />
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.recurrence}</span>
                </div>
                {c.due_at && <p className="text-xs text-muted-foreground mt-0.5">Due {c.due_at}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.status === "draft" && (
                  <button onClick={() => activateCampaign(c.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors active:scale-[0.97]">
                    Activate
                  </button>
                )}
                {c.status === "active" && (
                  <button
                    disabled={closing === c.id}
                    onClick={() => closeCampaign(c.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-600 border border-border transition-colors active:scale-[0.97] disabled:opacity-50"
                  >
                    {closing === c.id ? "Closing…" : "Close"}
                  </button>
                )}
                <button
                  onClick={() => expandCampaign(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.97] ${
                    expanded === c.id ? "bg-muted border-border" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {expanded === c.id ? "Collapse" : "View"}
                </button>
              </div>
            </div>

            {/* Expanded: attestations + add form */}
            {expanded === c.id && (
              <div className="border-t border-border bg-muted/20 animate-[pageEnter_0.2s_ease_both]">
                {/* Summary pills */}
                {result && (
                  <div className="px-4 pt-3 flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">{result.attested_count}/{result.total_subjects} attested</span>
                    {result.approved_count > 0 && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{result.approved_count} approved</span>}
                    {result.revoked_count > 0 && <span className="text-xs font-medium text-red-600 dark:text-red-400">{result.revoked_count} revoked</span>}
                    {result.no_change_count > 0 && <span className="text-xs text-muted-foreground">{result.no_change_count} no change</span>}
                  </div>
                )}

                {attLoading && <p className="px-4 py-3 text-xs text-muted-foreground animate-pulse">Loading attestations…</p>}

                {!attLoading && attestations.length > 0 && (
                  <div className="px-4 py-3 space-y-1">
                    {attestations.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 py-1.5 text-xs">
                        <OutcomeBadge outcome={a.outcome} />
                        <span className="text-muted-foreground font-mono">{a.subject_id}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-muted-foreground">{a.reviewer_email}</span>
                        {a.comment && <span className="text-muted-foreground/60 italic truncate max-w-xs">"{a.comment}"</span>}
                      </div>
                    ))}
                  </div>
                )}

                {!attLoading && attestations.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No attestations yet.</p>
                )}

                {/* Add attestation form (only for active campaigns) */}
                {c.status === "active" && (
                  <form onSubmit={(e) => submitAttestation(e, c.id)} className="px-4 pb-4 pt-2 border-t border-border/60">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Add Attestation</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                      <input
                        required
                        value={attForm.reviewer_email}
                        onChange={(e) => setAttForm((f) => ({ ...f, reviewer_email: e.target.value }))}
                        placeholder="reviewer@co.com"
                        className="col-span-2 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      />
                      <input
                        required
                        value={attForm.subject_id}
                        onChange={(e) => setAttForm((f) => ({ ...f, subject_id: e.target.value }))}
                        placeholder="user@co.com or system-name"
                        className="col-span-2 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      />
                      <select
                        value={attForm.outcome}
                        onChange={(e) => setAttForm((f) => ({ ...f, outcome: e.target.value as AttestationOutcome }))}
                        className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      >
                        <option value="approved">approved</option>
                        <option value="revoked">revoked</option>
                        <option value="no_change">no change</option>
                      </select>
                      <input
                        value={attForm.comment}
                        onChange={(e) => setAttForm((f) => ({ ...f, comment: e.target.value }))}
                        placeholder="Comment (optional)"
                        className="col-span-2 sm:col-span-3 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={attSaving}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all"
                      >
                        {attSaving ? "…" : "Attest"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
