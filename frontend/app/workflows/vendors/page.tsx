"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type VendorTier = "critical" | "high" | "medium" | "low";

type Vendor = {
  id: string;
  name: string;
  tier: VendorTier;
  contact_email?: string;
  description?: string;
};

type ExpiringDoc = {
  document_id: string;
  vendor_id: string;
  vendor_name: string;
  name: string;
  doc_type: string;
  expiry_date: string;
  days_until_expiry: number;
};

type VendorDoc = {
  id: string;
  name: string;
  doc_type: string;
  s3_key: string;
  expiry_date?: string;
};

const TIER_CONFIG: Record<VendorTier, { label: string; class: string; desc: string }> = {
  critical: { label: "Critical", class: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20", desc: "Handles PHI or core infra" },
  high: { label: "High", class: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20", desc: "Significant data access" },
  medium: { label: "Medium", class: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20", desc: "Limited data access" },
  low: { label: "Low", class: "bg-muted text-muted-foreground", desc: "No sensitive data access" },
};

function TierBadge({ tier }: { tier: VendorTier }) {
  const cfg = TIER_CONFIG[tier];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.class}`}>{cfg.label}</span>;
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

export default function WorkflowsVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expiring, setExpiring] = useState<ExpiringDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contact_email: "", tier: "medium" as VendorTier, description: "" });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [docs, setDocs] = useState<VendorDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", doc_type: "SOC2", s3_key: "", expiry_date: "" });
  const [docSaving, setDocSaving] = useState(false);
  const [tierChanging, setTierChanging] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => setToast({ msg, type });

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch("/api/v1/workflows/vendors").then((r) => r.ok ? r.json() : []),
      apiFetch("/api/v1/workflows/vendors/expiring?within_days=90").then((r) => r.ok ? r.json() : []),
    ]).then(([v, e]) => { setVendors(v); setExpiring(e); }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function createVendor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = { name: form.name, tier: form.tier };
      if (form.contact_email) body.contact_email = form.contact_email;
      if (form.description) body.description = form.description;
      const r = await apiFetch("/api/v1/workflows/vendors", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      const vendor: Vendor = await r.json();
      setVendors((prev) => [vendor, ...prev]);
      setForm({ name: "", contact_email: "", tier: "medium", description: "" });
      setShowForm(false);
      showToast(`${vendor.name} added`, "success");
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeTier(vendorId: string, tier: VendorTier) {
    setTierChanging(vendorId);
    const r = await apiFetch(`/api/v1/workflows/vendors/${vendorId}/tier`, {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    if (r.ok) {
      setVendors((prev) => prev.map((v) => v.id === vendorId ? { ...v, tier } : v));
      showToast("Tier updated", "success");
    }
    setTierChanging(null);
  }

  async function expandVendor(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setDocsLoading(true);
    const r = await apiFetch(`/api/v1/workflows/vendors/${id}/documents`);
    setDocs(r.ok ? await r.json() : []);
    setDocsLoading(false);
  }

  async function addDocument(e: React.FormEvent, vendorId: string) {
    e.preventDefault();
    setDocSaving(true);
    try {
      const body: Record<string, string> = { name: docForm.name, doc_type: docForm.doc_type, s3_key: docForm.s3_key };
      if (docForm.expiry_date) body.expiry_date = docForm.expiry_date;
      const r = await apiFetch(`/api/v1/workflows/vendors/${vendorId}/documents`, { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      const doc: VendorDoc = await r.json();
      setDocs((prev) => [...prev, doc]);
      setDocForm({ name: "", doc_type: "SOC2", s3_key: "", expiry_date: "" });
      showToast("Document added", "success");
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setDocSaving(false);
    }
  }

  const isEmpty = !loading && vendors.length === 0;
  const criticalCount = vendors.filter((v) => v.tier === "critical").length;

  return (
    <div className="page-enter max-w-5xl">
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/workflows" className="text-sm text-muted-foreground hover:text-foreground mb-1 inline-block transition-colors">← Workflows</Link>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Vendors</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Vendor risk management — SOC 2 CC9.2 · HIPAA §164.308(b) Business Associates
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Add Vendor
        </button>
      </header>

      {/* Summary stats */}
      {vendors.length > 0 && (
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          {(["critical", "high", "medium", "low"] as VendorTier[]).map((tier) => {
            const count = vendors.filter((v) => v.tier === tier).length;
            if (count === 0) return null;
            return (
              <div key={tier} className="flex items-center gap-1.5">
                <TierBadge tier={tier} />
                <span className="text-sm font-semibold">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Expiring docs banner */}
      {expiring.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/20">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {expiring.length} vendor document{expiring.length !== 1 ? "s" : ""} expiring within 90 days
            </span>
          </div>
          <div className="divide-y divide-amber-500/10">
            {expiring.map((d) => {
              const urgent = d.days_until_expiry <= 14;
              return (
                <div key={d.document_id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${urgent ? "bg-red-500/20 text-red-700 dark:text-red-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                    {d.days_until_expiry}d
                  </span>
                  <span className="font-medium">{d.vendor_name}</span>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="text-xs text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded ml-auto">{d.doc_type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={createVendor} className="mb-6 rounded-xl border border-border bg-[hsl(var(--card-bg))] p-5 animate-[pageEnter_0.2s_ease_both]">
          <h2 className="text-sm font-semibold mb-4">New Vendor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Cloud Inc." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Risk tier</label>
              <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as VendorTier }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                {(["critical", "high", "medium", "low"] as VendorTier[]).map((t) => (
                  <option key={t} value={t}>{TIER_CONFIG[t].label} — {TIER_CONFIG[t].desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Contact email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} placeholder="security@vendor.com" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What do they do for us?" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all">
              {saving ? "Adding…" : "Add Vendor"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {loading && <p className="text-muted-foreground animate-pulse">Loading…</p>}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28 mb-6 opacity-40">
            <rect x="10" y="30" width="100" height="60" rx="8" stroke="currentColor" strokeWidth="2" />
            <path d="M35 30V20a15 15 0 0 1 30 0v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M40 55h40M40 68h25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="60" cy="50" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M57 50l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-lg font-medium mb-1">No vendors tracked</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            SOC 2 CC9.2 requires documented vendor risk management. HIPAA requires BAAs with all Business Associates. Start by adding your critical vendors.
          </p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            Add First Vendor
          </button>
        </div>
      )}

      {/* Vendor list */}
      <div className="space-y-2">
        {vendors.map((v) => (
          <div key={v.id} className="rounded-xl border border-border bg-[hsl(var(--card-bg))] overflow-hidden transition-all">
            <div className="flex items-center gap-4 p-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                v.tier === "critical" ? "bg-red-500/10 text-red-600" :
                v.tier === "high" ? "bg-orange-500/10 text-orange-600" :
                v.tier === "medium" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
              }`}>
                {v.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{v.name}</span>
                  <TierBadge tier={v.tier} />
                </div>
                {v.contact_email && <span className="text-xs text-muted-foreground">{v.contact_email}</span>}
                {v.description && <span className="text-xs text-muted-foreground ml-2">· {v.description}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Tier quick-change */}
                <select
                  value={v.tier}
                  disabled={tierChanging === v.id}
                  onChange={(e) => changeTier(v.id, e.target.value as VendorTier)}
                  className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50"
                >
                  {(["critical", "high", "medium", "low"] as VendorTier[]).map((t) => (
                    <option key={t} value={t}>{TIER_CONFIG[t].label}</option>
                  ))}
                </select>
                <button
                  onClick={() => expandVendor(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-[0.97] ${
                    expanded === v.id ? "bg-muted border-border" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {expanded === v.id ? "Collapse" : "Documents"}
                </button>
              </div>
            </div>

            {/* Documents panel */}
            {expanded === v.id && (
              <div className="border-t border-border bg-muted/20 animate-[pageEnter_0.2s_ease_both]">
                {docsLoading && <p className="px-4 py-3 text-xs text-muted-foreground animate-pulse">Loading documents…</p>}

                {!docsLoading && docs.length > 0 && (
                  <div className="px-4 py-3 space-y-1.5">
                    {docs.map((doc) => {
                      const daysLeft = doc.expiry_date
                        ? Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / 86400000)
                        : null;
                      return (
                        <div key={doc.id} className="flex items-center gap-3 text-xs py-1">
                          <span className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">{doc.doc_type}</span>
                          <span className="font-medium">{doc.name}</span>
                          {daysLeft !== null && (
                            <span className={`ml-auto px-1.5 py-0.5 rounded font-medium ${
                              daysLeft <= 14 ? "bg-red-500/10 text-red-700 dark:text-red-400" :
                              daysLeft <= 90 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                              "text-muted-foreground"
                            }`}>
                              {daysLeft > 0 ? `exp. in ${daysLeft}d` : "EXPIRED"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!docsLoading && docs.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No documents yet. Add SOC 2 reports, BAAs, or other vendor compliance docs below.</p>
                )}

                {/* Add document form */}
                <form onSubmit={(e) => addDocument(e, v.id)} className="px-4 pb-4 pt-2 border-t border-border/60">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Add Document</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input required value={docForm.name} onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))} placeholder="SOC 2 Type II Report" className="col-span-2 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                    <select value={docForm.doc_type} onChange={(e) => setDocForm((f) => ({ ...f, doc_type: e.target.value }))} className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all">
                      {["SOC2", "BAA", "ISO27001", "HIPAA", "questionnaire", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm((f) => ({ ...f, expiry_date: e.target.value }))} placeholder="Expiry" className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                    <input required value={docForm.s3_key} onChange={(e) => setDocForm((f) => ({ ...f, s3_key: e.target.value }))} placeholder="vendors/acme/soc2-2025.pdf" className="col-span-3 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                    <button type="submit" disabled={docSaving} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] disabled:opacity-50 transition-all">
                      {docSaving ? "…" : "Add"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
