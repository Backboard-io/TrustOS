"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { ReleaseNotesModal } from "./ReleaseNotesModal";

const PUBLIC_PATHS = ["/login", "/signup"];
const APP_VERSION = "0.1.0";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="px-8 py-8 min-h-full flex flex-col">
          <div className="flex-1">{children}</div>
          <div className="pt-8 pb-2 flex justify-center">
            <button
              onClick={() => setShowReleaseNotes(true)}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground select-none tabular-nums transition-colors duration-150 cursor-pointer"
            >
              v{APP_VERSION}
            </button>
          </div>
        </div>
      </main>

      {showReleaseNotes && (
        <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />
      )}
    </div>
  );
}
