"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
type Evidence = {
  id: string;
  run_id: string | null;
  control_id: string | null;
  file_name: string;
  s3_key: string;
  content_type: string;
  uploaded_at: string;
  uploaded_by: string | null;
  checksum: string | null;
};

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const load = () => {
    apiFetch("/api/v1/evidence")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setEvidence)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", uploadFile);
    try {
      const r = await apiFetch("/api/v1/evidence/upload", {
        method: "POST",
        body: form,
      });
      if (!r.ok) throw new Error(await r.text());
      setUploadFile(null);
      load();
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const getDownloadUrl = async (artifactId: string) => {
    const r = await apiFetch(`/api/v1/evidence/${artifactId}/download`);
    const data = await r.json();
    if (data.download_url) window.open(data.download_url, "_blank");
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-semibold">Evidence vault</h1>
        <p className="text-muted-foreground text-sm">Manual and automated evidence artifacts</p>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-2">Upload evidence</h2>
        <form onSubmit={handleUpload} className="flex gap-2 items-center">
          <input
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            type="submit"
            disabled={!uploadFile || uploading}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Evidence list</h2>
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {error && <p className="text-destructive">{error}</p>}
        {!loading && !error && evidence.length === 0 && (
          <p className="text-muted-foreground">No evidence yet. Upload a file above.</p>
        )}
        {!loading && !error && evidence.length > 0 && (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">File name</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Uploaded</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{e.file_name}</td>
                    <td className="p-2 text-muted-foreground">{e.content_type}</td>
                    <td className="p-2">{new Date(e.uploaded_at).toLocaleString()}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => getDownloadUrl(e.id)}
                        className="text-primary hover:underline"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
