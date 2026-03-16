"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";

type AccessReview = {
  id: string;
  reviewer_email: string;
  reviewee_email: string;
  system_name: string;
  access_level: string;
  review_date: string;
  next_review_date: string;
  decision: "approved" | "revoked" | "modified" | "pending";
  created_at: string;
};


const DECISION_STYLES: Record<string, string> = {
  approved: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  revoked: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  modified: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  pending: "bg-muted text-muted-foreground",
};

export default function AccessReviewsPage() {
  const [reviews, setReviews] = useState<AccessReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    reviewer_email: "",
    reviewee_email: "",
    system_name: "",
    access_level: "",
    review_date: new Date().toISOString().split("T")[0],
    next_review_date: "",
    decision: "pending" as AccessReview["decision"],
  });

  const load = () => {
    setLoading(true);
    apiFetch("/api/v1/hipaa/access-reviews")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => { setReviews(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/v1/hipaa/access-reviews", {
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

  const today = new Date().toISOString().split("T")[0];
  const overdue = reviews.filter((r) => r.next_review_date < today && r.decision !== "revoked");

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Access Authorization Reviews</h1>
        <p className="text-muted-foreground text-sm">§164.308(a)(4) — Information access management and periodic review</p>
      </header>

      {overdue.length > 0 && (
        <div className="mb-6">
          <span className="text-sm px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
            {overdue.length} access review{overdue.length !== 1 ? "s" : ""} past due date
          </span>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90">
          {showForm ? "Cancel" : "+ Add Review"}
        </button>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-6 mb-6 bg-[hsl(var(--card-bg))] space-y-4">
          <h3 className="font-medium">New access review</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Reviewer email *</label>
              <input required type="email" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.reviewer_email} onChange={(e) => setForm({ ...form, reviewer_email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reviewee email *</label>
              <input required type="email" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.reviewee_email} onChange={(e) => setForm({ ...form, reviewee_email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">System name *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.system_name} onChange={(e) => setForm({ ...form, system_name: e.target.value })} placeholder="EMR, AWS Console, VPN" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Access level *</label>
              <input required className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value })} placeholder="Read, Write, Admin" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Review date *</label>
              <input required type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Next review date *</label>
              <input required type="date" className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.next_review_date} onChange={(e) => setForm({ ...form, next_review_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Decision</label>
              <select className="w-full border rounded px-3 py-2 text-sm bg-background" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value as AccessReview["decision"] })}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="modified">Modified</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-md bg-bb-blue text-white hover:bg-bb-blue/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save review"}
          </button>
        </form>
      )}

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && reviews.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No access reviews recorded</p>
          <p className="text-sm">Conduct periodic access authorization reviews for all ePHI systems.</p>
        </div>
      )}
      {!loading && reviews.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Reviewee</th>
                <th className="text-left p-3">System</th>
                <th className="text-left p-3">Access</th>
                <th className="text-left p-3">Reviewer</th>
                <th className="text-left p-3">Next review</th>
                <th className="text-left p-3">Decision</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const overdueMark = r.next_review_date < today && r.decision !== "revoked";
                return (
                  <tr key={r.id} className={`border-t hover:bg-muted/20 ${overdueMark ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                    <td className="p-3">{r.reviewee_email}</td>
                    <td className="p-3 font-medium">{r.system_name}</td>
                    <td className="p-3 text-muted-foreground">{r.access_level}</td>
                    <td className="p-3 text-muted-foreground text-xs">{r.reviewer_email}</td>
                    <td className={`p-3 text-xs font-medium ${overdueMark ? "text-amber-600" : "text-muted-foreground"}`}>
                      {r.next_review_date}{overdueMark ? " ⚠" : ""}
                    </td>
                    <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${DECISION_STYLES[r.decision]}`}>{r.decision}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
