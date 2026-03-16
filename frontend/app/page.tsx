"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { COMPLIANCE_FRAMEWORKS, COLOR_TOKENS } from "@/app/lib/frameworks";

type ControlSummary = { framework: string; count: number };

export default function Home() {
  const [summary, setSummary] = useState<ControlSummary[]>([]);

  useEffect(() => {
    apiFetch("/api/v1/controls")
      .then((r) => (r.ok ? r.json() : []))
      .then((controls: { framework: string }[]) => {
        const counts: Record<string, number> = {};
        for (const c of controls) {
          counts[c.framework] = (counts[c.framework] ?? 0) + 1;
        }
        setSummary(Object.entries(counts).map(([framework, count]) => ({ framework, count })));
      })
      .catch(() => {});
  }, []);

  function controlCount(catalogKey: string) {
    return summary.find((s) => s.framework === catalogKey)?.count ?? null;
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Compliance Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select a compliance module to get started, or use the tools above for
          cross-framework work.
        </p>
      </div>

      {/* Framework cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {COMPLIANCE_FRAMEWORKS.map((fw) => {
          const tokens = COLOR_TOKENS[fw.color];
          const count = controlCount(fw.catalogKey);
          return (
            <Link
              key={fw.id}
              href={fw.overviewHref}
              className="group relative flex flex-col gap-3 rounded-xl border border-border bg-[hsl(var(--card-bg))] p-5 card-hover transition-shadow duration-200"
            >
              {/* Color accent strip */}
              <div
                className={[
                  "absolute inset-x-0 top-0 h-0.5 rounded-t-xl transition-opacity duration-200 opacity-0 group-hover:opacity-100",
                  fw.color === "blue"    ? "bg-bb-blue"      :
                  fw.color === "emerald" ? "bg-emerald-500"  :
                  fw.color === "violet"  ? "bg-violet-500"   :
                  fw.color === "amber"   ? "bg-amber-500"    : "bg-rose-500",
                ].join(" ")}
              />

              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground leading-tight">
                    {fw.label}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fw.description}
                  </p>
                </div>
                <span
                  className={[
                    "shrink-0 mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide",
                    tokens.badge,
                  ].join(" ")}
                >
                  {fw.shortLabel}
                </span>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {count !== null ? (
                  <span>
                    <span className="font-semibold text-foreground">{count}</span>{" "}
                    controls
                  </span>
                ) : (
                  <span className="italic">Loading…</span>
                )}
                <span className="ml-auto text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Open →
                </span>
              </div>

              {/* Quick links */}
              <div className="flex flex-wrap gap-1 pt-1 border-t border-border/60">
                {fw.subNav.slice(0, 4).map(({ href, label }) => (
                  <span
                    key={href}
                    className="px-2 py-0.5 rounded text-[11px] bg-muted/60 text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
                {fw.subNav.length > 4 && (
                  <span className="px-2 py-0.5 rounded text-[11px] bg-muted/60 text-muted-foreground">
                    +{fw.subNav.length - 4} more
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        {/* "Add module" placeholder card */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center min-h-[160px]">
          <span className="text-2xl">+</span>
          <p className="text-sm font-medium text-muted-foreground">Add framework</p>
          <p className="text-xs text-muted-foreground/60 max-w-[180px]">
            FedRAMP, ISO 27001, PCI-DSS and more coming soon
          </p>
        </div>
      </div>

      {/* Global tools strip */}
      <div className="rounded-xl border border-border bg-[hsl(var(--card-bg))] p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Cross-framework tools
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/evidence",     label: "Evidence Vault",  desc: "All uploaded evidence" },
            { href: "/runs",         label: "Assessment Runs", desc: "Scan results & checks" },
            { href: "/posture",      label: "Posture",         desc: "Coverage across frameworks" },
            { href: "/integrations", label: "Integrations",    desc: "Connected tools" },
            { href: "/export",       label: "Audit Export",    desc: "Auditor-ready bundles" },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-0.5 px-4 py-3 rounded-lg border border-border hover:border-border/80 hover:bg-muted/40 transition-colors duration-150 min-w-[140px]"
            >
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
