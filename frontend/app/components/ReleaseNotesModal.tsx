"use client";

import { useEffect } from "react";
import { X, Tag } from "lucide-react";

interface Release {
  version: string;
  date: string;
  sections: { heading: string; items: string[] }[];
  infrastructure?: string[];
}

const RELEASES: Release[] = [
  {
    version: "0.1.2",
    date: "2026-03-20",
    sections: [
      {
        heading: "Changed",
        items: [
          "Branding — TrustOS naming across API, env example, and frontend package",
          "README — hero logo, positioning, and clearer navigation",
          "Assets — logo and favicon refresh",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-03-16",
    sections: [
      {
        heading: "Added",
        items: [
          "Compliance Hub — home screen with module selection for SOC 2, HIPAA, and cross-framework work",
          "SOC 2 TSC module — AICPA Trust Services Criteria control tracking with 15 controls, posture history, and remediation workflows",
          "HIPAA module — PHI asset registry, BAA management, access reviews, incident tracking, policy management, training, risk assessments, and contingency planning",
          "Controls — individual control detail pages with evidence attachment, history timeline, and status management",
          "Audit runs — automated compliance run execution with per-control pass/fail results and audit trail",
          "Evidence management — evidence upload, linking to controls, and export workflows",
          "Vendor management — vendor inventory with compliance tracking",
          "Policy management — policy library with versioning and review workflows",
          "People & access reviews — user roster and periodic access review workflows",
          "Reports — compliance posture reports and export",
          "Trust portal — public-facing trust center page",
          "Admin panel — workspace configuration and user management",
          "Integrations — third-party integration connection hub",
          "Sidebar navigation — collapsible sidebar with module-aware routing",
          "Dark mode — full light/dark theme toggle",
          "Auth — login, signup, and route-level auth guard",
          "Backboard integration — AI assistant powered by Backboard SDK for cross-framework queries",
          "Version badge — displayed at bottom center of the application shell",
        ],
      },
    ],
    infrastructure: [
      "Next.js 15 + React 19 frontend with Tailwind CSS and shadcn/ui components",
      "FastAPI backend with Pydantic models throughout",
      "Backboard-backed assistant and document storage",
      "Docker Compose local development stack",
      "start.sh with trap-on-exit process management",
    ],
  },
];

interface Props {
  onClose: () => void;
}

export function ReleaseNotesModal({ onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Release Notes"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <Tag size={15} strokeWidth={1.75} className="text-muted-foreground" />
          <h2 className="flex-1 text-sm font-semibold text-foreground">Release Notes</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {RELEASES.map((release) => (
            <div key={release.version}>
              {/* Version + date */}
              <div className="flex items-baseline gap-2.5 mb-3">
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  v{release.version}
                </span>
                <span className="text-xs text-muted-foreground">{release.date}</span>
              </div>

              {/* Sections */}
              {release.sections.map((section) => (
                <div key={section.heading} className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2 select-none">
                    {section.heading}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Infrastructure */}
              {release.infrastructure && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2 select-none">
                    Infrastructure
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {release.infrastructure.map((item) => (
                      <li key={item} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
