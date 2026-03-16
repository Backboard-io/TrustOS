"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type Doc = { id: string; title: string; description?: string; is_public: boolean; requires_nda: boolean };

export default function TrustPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [library, setLibrary] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/trust/documents").then((r) => r.ok ? r.json() : []),
      apiFetch("/api/v1/trust/questionnaire-library").then((r) => r.ok ? r.json() : []),
    ])
      .then(([d, l]) => { setDocuments(d); setLibrary(l); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-enter max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Trust Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Public documents and customer security questionnaire library.</p>
      </header>

      {loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">Error: {error}</p>}

      {!loading && !error && (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documents</h2>
            <div className="rounded-xl border border-border bg-[hsl(var(--card-bg))] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Public</th>
                    <th className="text-left p-3 font-medium">Requires NDA</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 && (
                    <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No documents.</td></tr>
                  )}
                  {documents.map((d) => (
                    <tr key={d.id} className="border-b border-border/60">
                      <td className="p-3">{d.title}</td>
                      <td className="p-3">{d.is_public ? "Yes" : "No"}</td>
                      <td className="p-3">{d.requires_nda ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Questionnaire library</h2>
            <div className="rounded-xl border border-border bg-[hsl(var(--card-bg))] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left p-3 font-medium">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {library.length === 0 && (
                    <tr><td className="p-6 text-center text-muted-foreground">No questionnaire templates.</td></tr>
                  )}
                  {library.map((q) => (
                    <tr key={q.id} className="border-b border-border/60">
                      <td className="p-3">{q.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
