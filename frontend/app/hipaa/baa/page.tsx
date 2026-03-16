"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type BAAVendor = {
  id: string;
  vendor_name: string;
  contact_email: string | null;
  services_provided: string | null;
  baa_signed_date: string | null;
  baa_expiry_date: string | null;
  status: "active" | "expired" | "pending";
  s3_key: string | null;
  created_at: string;
  days_until_expiry: number | null;
};


function ExpiryChip({ days, status }: { days: number | null; status: string }) {
  if (status === "expired" || (days !== null && days < 0))
    return <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Expired</span>;
  if (days !== null && days <= 90)
    return <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Expires in {days}d</span>;
  if (status === "active")
    return <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Active</span>;
  return <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">{status}</span>;
}

export default function BAAPage() {
  const [vendors, setVendors] = useState<BAAVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_name: "",
    contact_email: "",
    services_provided: "",
    baa_signed_date: "",
    baa_expiry_date: "",
    status: "active" as "active" | "expired" | "pending",
  });

  const load = () => {
    setLoading(true);
    apiFetch("/api/v1/hipaa/baa")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setVendors(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/hipaa/baa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          baa_signed_date: form.baa_signed_date || null,
          baa_expiry_date: form.baa_expiry_date || null,
          contact_email: form.contact_email || null,
          services_provided: form.services_provided || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowForm(false);
      setForm({ vendor_name: "", contact_email: "", services_provided: "", baa_signed_date: "", baa_expiry_date: "", status: "active" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const expiring = vendors.filter((v) => v.days_until_expiry !== null && v.days_until_expiry <= 90 && v.days_until_expiry >= 0);
  const expired = vendors.filter((v) => v.status === "expired" || (v.days_until_expiry !== null && v.days_until_expiry < 0));

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Business Associate Agreements</h1>
        <p className="text-muted-foreground text-sm">§164.308(b)(1) — Vendor BAA tracking and document management</p>
      </header>

      {(expiring.length > 0 || expired.length > 0) && (
        <div className="flex gap-3 mb-6">
          {expired.length > 0 && <span className="text-sm px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 font-medium">{expired.length} expired</span>}
          {expiring.length > 0 && <span className="text-sm px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">{expiring.length} expiring within 90 days</span>}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Add Vendor"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">New BAA vendor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vendor name *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact email</label>
              <input type="email" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">BAA signed date</label>
              <input type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.baa_signed_date} onChange={(e) => setForm({ ...form, baa_signed_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">BAA expiry date</label>
              <input type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.baa_expiry_date} onChange={(e) => setForm({ ...form, baa_expiry_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "expired" | "pending" })}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Services provided</label>
              <input className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.services_provided} onChange={(e) => setForm({ ...form, services_provided: e.target.value })} placeholder="Cloud hosting, data processing" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save vendor"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && vendors.length === 0 && !showForm && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No BAA vendors registered</p>
          <p className="text-sm">Track all business associates that access ePHI.</p>
        </div>
      )}
      {!loading && vendors.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Signed</th>
                <th className="text-left p-3">Expires</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{v.vendor_name}</td>
                  <td className="p-3 text-muted-foreground text-xs">{v.contact_email ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{v.baa_signed_date ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{v.baa_expiry_date ?? "—"}</td>
                  <td className="p-3"><ExpiryChip days={v.days_until_expiry} status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
