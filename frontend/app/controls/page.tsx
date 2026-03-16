"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

type Control = {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  framework: string;
  created_at: string;
  updated_at: string;
};

const FRAMEWORKS = [
  { value: "",                      label: "All" },
  { value: "SOC2-TSC",              label: "SOC 2 TSC" },
  { value: "HIPAA-Security-Rule",   label: "HIPAA" },
];

function ControlsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const framework = searchParams.get("framework") ?? "";

  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (framework) params.set("framework", framework);
    apiFetch(`/api/v1/controls?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: Control[]) => { setControls(data); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [framework]);

  const setFramework = (v: string) => {
    const params = new URLSearchParams();
    if (v) params.set("framework", v);
    router.push(`/controls?${params}`);
  };

  const activeFramework = FRAMEWORKS.find((f) => f.value === framework) ?? FRAMEWORKS[0];

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Control library</h1>
        <p className="text-muted-foreground text-sm">OSCAL-derived controls across all loaded frameworks</p>
      </header>

      {/* Framework pills */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-muted-foreground">Framework:</span>
        {FRAMEWORKS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFramework(f.value)}
            className={[
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              f.value === framework
                ? f.value === "HIPAA-Security-Rule"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/40"
                  : "bg-bb-blue/10 text-bb-blue ring-1 ring-bb-blue/30"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
            ].join(" ")}
          >
            {f.label}
            {!loading && f.value === framework && (
              <span className="ml-1.5 text-xs opacity-70">({controls.length})</span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-muted-foreground">Loading controls…</p>}
      {error && <p className="text-destructive">Error: {error}</p>}
      {!loading && !error && controls.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-lg mb-1">No controls loaded for {activeFramework.label}</p>
          <p className="text-sm">Run the OSCAL seed script to load this framework&apos;s catalog.</p>
        </div>
      )}
      {!loading && !error && controls.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Framework</th>
                <th className="text-left p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {controls.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{c.external_id}</td>
                  <td className="p-3">{c.title}</td>
                  <td className="p-3">
                    <span className={[
                      "text-xs font-medium px-2 py-0.5 rounded",
                      c.framework === "HIPAA-Security-Rule"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-bb-blue/10 text-bb-blue",
                    ].join(" ")}>
                      {c.framework === "HIPAA-Security-Rule" ? "HIPAA" : c.framework}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link href={`/controls/${c.id}`} className="text-sm text-bb-blue hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ControlsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
      <ControlsContent />
    </Suspense>
  );
}
