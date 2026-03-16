"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Control = {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  framework: string;
  created_at: string;
  updated_at: string;
};

type Mapping = {
  id: string;
  tool_id: string;
  external_control_id: string;
  control_catalog_id: string;
  created_at: string;
};

export default function ControlDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [control, setControl] = useState<Control | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch(`/api/v1/controls/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText)))),
      apiFetch(`/api/v1/controls/${id}/mappings`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([c, m]) => {
        setControl(c);
        setMappings(m);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (error || !control) return <p className="p-6 text-destructive">{error || "Not found"}</p>;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="border rounded p-6 space-y-4">
        <div>
          <span className="font-mono text-muted-foreground">{control.external_id}</span>
          <h1 className="text-xl font-semibold mt-1">{control.title}</h1>
          <p className="text-sm text-muted-foreground">{control.framework}</p>
        </div>
        {control.description && <p className="text-sm">{control.description}</p>}
        <div>
          <h2 className="font-medium mb-2">Tool mappings</h2>
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tool mappings yet.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {mappings.map((m) => (
                <li key={m.id}>
                  <span className="font-mono">{m.tool_id}</span> → {m.external_control_id}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href={`/controls/${id}/history`} className="text-primary text-sm hover:underline">
          View pass/fail history
        </Link>
      </div>
    </div>
  );
}
