"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import {
  Shield,
  HeartPulse,
  FileText,
  Play,
  Plug,
  Download,
  Users,
  CalendarCheck,
  FileCheck2,
  Building2,
  Eye,
  ShieldCheck,
  BarChart3,
  Settings2,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Plus,
  Workflow,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import {
  COMPLIANCE_FRAMEWORKS,
  detectActiveFramework,
} from "@/app/lib/frameworks";

const PUBLIC_PATHS = ["/login", "/signup"];

const FRAMEWORK_META: Record<string, {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  dot: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  subActiveBg: string;
  subActiveText: string;
}> = {
  soc2: {
    Icon: Shield,
    dot: "bg-bb-blue",
    activeBg: "bg-bb-blue/8 dark:bg-bb-blue/10",
    activeText: "text-bb-blue",
    activeBorder: "border-bb-blue",
    subActiveBg: "bg-bb-blue/8",
    subActiveText: "text-bb-blue",
  },
  hipaa: {
    Icon: HeartPulse,
    dot: "bg-emerald-500",
    activeBg: "bg-emerald-500/8 dark:bg-emerald-500/10",
    activeText: "text-emerald-600 dark:text-emerald-400",
    activeBorder: "border-emerald-500",
    subActiveBg: "bg-emerald-500/8",
    subActiveText: "text-emerald-700 dark:text-emerald-300",
  },
};

const TOOL_LINKS = [
  { href: "/evidence",     label: "Evidence",      Icon: FileText },
  { href: "/runs",         label: "Checks",        Icon: Play },
  { href: "/integrations", label: "Integrations",  Icon: Plug },
  { href: "/export",       label: "Export",        Icon: Download },
];

const WORKFLOW_LINKS = [
  { href: "/workflows/people",         label: "People",         Icon: Users },
  { href: "/workflows/access-reviews", label: "Access Reviews", Icon: CalendarCheck },
  { href: "/workflows/policies",       label: "Policies",       Icon: FileCheck2 },
  { href: "/workflows/vendors",        label: "Vendors",        Icon: Building2 },
];

const PLATFORM_LINKS = [
  { href: "/auditor", label: "Auditor",      Icon: Eye },
  { href: "/trust",   label: "Trust Center", Icon: ShieldCheck },
  { href: "/reports", label: "Reports",      Icon: BarChart3 },
];

function isActive(href: string, pathname: string, frameworkParam: string, exact?: boolean): boolean {
  const [hrefPath, hrefQuery] = href.split("?");
  const qp = new URLSearchParams(hrefQuery ?? "");
  const hrefFw = qp.get("framework") ?? "";
  if (hrefFw) return pathname === hrefPath && frameworkParam === hrefFw;
  if (exact) return pathname === hrefPath;
  return hrefPath === "/" ? pathname === "/" : pathname.startsWith(hrefPath);
}

const COLLAPSED_W = 56;
const EXPANDED_W = 224;

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const frameworkParam = searchParams.get("framework") ?? "";
  const { user, selectedApp, clearApp, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem("ps_sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem("ps_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  // Auto-expand workflows section when navigating there
  useEffect(() => {
    if (pathname.startsWith("/workflows")) setWorkflowsOpen(true);
  }, [pathname]);

  // Hide on public pages (login/signup will be full-screen on their own)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return null;

  const activeFramework = detectActiveFramework(pathname, frameworkParam);
  const W = collapsed ? COLLAPSED_W : EXPANDED_W;

  const navLink = (
    href: string,
    label: string,
    Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>,
    exact?: boolean,
    activeClass = "bg-muted text-foreground",
    inactiveClass = "text-muted-foreground hover:text-foreground hover:bg-muted/60",
  ) => {
    const active = isActive(href, pathname, frameworkParam, exact);
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        className={[
          "flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 min-w-0",
          active ? activeClass : inactiveClass,
        ].join(" ")}
      >
        <Icon size={15} strokeWidth={1.75} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className="relative flex flex-col h-screen overflow-y-auto overflow-x-hidden border-r border-border bg-[hsl(var(--sidebar-bg))] transition-[width] duration-200 ease-in-out"
      style={{ width: W, minWidth: W }}
    >
      {/* ── Logo + collapse ── */}
      <div className="shrink-0 flex items-center h-14 px-3 border-b border-border gap-2">
        {!collapsed ? (
          <>
            <Link href="/" className="flex items-center flex-1 min-w-0">
              <Image src="/assets/logo.png" alt="TrustOS" width={100} height={28} className="object-contain" priority />
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="shrink-0 p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={14} strokeWidth={2} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ── Nav sections ── */}
      <nav className="flex-1 flex flex-col gap-4 px-2 py-4 overflow-y-auto min-h-0">

        {/* Home */}
        {navLink("/", "Home", LayoutGrid, true)}

        {/* ── COMPLIANCE ── */}
        <section>
          {!collapsed && (
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
              Compliance
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {COMPLIANCE_FRAMEWORKS.map((fw) => {
              const fwActive = activeFramework?.id === fw.id;
              const meta = FRAMEWORK_META[fw.id] ?? FRAMEWORK_META["soc2"];
              const { Icon } = meta;

              return (
                <div key={fw.id}>
                  <Link
                    href={fw.overviewHref}
                    title={collapsed ? fw.label : undefined}
                    className={[
                      "flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150",
                      "border-l-2",
                      fwActive
                        ? `${meta.activeBg} ${meta.activeText} ${meta.activeBorder}`
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    ].join(" ")}
                  >
                    <Icon size={15} strokeWidth={1.75} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{fw.shortLabel}</span>
                        {fwActive
                          ? <ChevronDown size={11} className="shrink-0 opacity-60" />
                          : <ChevronRight size={11} className="shrink-0 opacity-25" />
                        }
                      </>
                    )}
                  </Link>

                  {/* Framework sub-nav — shown only when active */}
                  {fwActive && !collapsed && (
                    <div className="ml-5 mt-0.5 mb-1 flex flex-col gap-0.5 border-l-2 border-border pl-2">
                      {fw.subNav.map(({ href, label, exact }) => {
                        const subActive = isActive(href, pathname, frameworkParam, exact);
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={[
                              "px-2 py-1 rounded-md text-xs font-medium transition-colors duration-150",
                              subActive
                                ? `${meta.subActiveBg} ${meta.subActiveText}`
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                            ].join(" ")}
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* + Add framework */}
            {!collapsed && (
              <button
                title="More compliance modules coming soon"
                className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40 transition-colors border-l-2 border-transparent"
              >
                <Plus size={13} strokeWidth={2} className="shrink-0" />
                <span>Add framework</span>
              </button>
            )}
          </div>
        </section>

        {/* ── TOOLS ── */}
        <section>
          {!collapsed && (
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
              Tools
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {TOOL_LINKS.map(({ href, label, Icon }) =>
              navLink(href, label, Icon),
            )}
          </div>
        </section>

        {/* ── PLATFORM ── */}
        <section>
          {!collapsed && (
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
              Platform
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {/* Workflows — expandable parent */}
            <button
              onClick={() => {
                if (!collapsed) {
                  setWorkflowsOpen((o) => !o);
                } else {
                  router.push("/workflows");
                }
              }}
              title={collapsed ? "Workflows" : undefined}
              className={[
                "w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 text-left",
                pathname.startsWith("/workflows")
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              ].join(" ")}
            >
              <Workflow size={15} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">Workflows</span>
                  {workflowsOpen
                    ? <ChevronDown size={11} className="shrink-0 opacity-60" />
                    : <ChevronRight size={11} className="shrink-0 opacity-25" />
                  }
                </>
              )}
            </button>

            {/* Workflow children */}
            {workflowsOpen && !collapsed && (
              <div className="ml-5 mb-1 flex flex-col gap-0.5 border-l-2 border-border pl-2">
                {WORKFLOW_LINKS.map(({ href, label, Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={[
                        "flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-colors duration-150",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      ].join(" ")}
                    >
                      <Icon size={12} strokeWidth={1.75} className="shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Flat platform links */}
            {PLATFORM_LINKS.map(({ href, label, Icon }) =>
              navLink(href, label, Icon),
            )}
          </div>
        </section>
      </nav>

      {/* ── Footer ── */}
      <div className="shrink-0 border-t border-border px-2 py-3 flex flex-col gap-1">
        {/* App switcher */}
        {selectedApp && (
          <button
            onClick={() => { clearApp(); router.push("/apps"); }}
            title={collapsed ? selectedApp.name : "Switch workspace"}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-left"
          >
            <span className="w-5 h-5 rounded-md bg-bb-blue/10 text-bb-blue flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
              {selectedApp.name.charAt(0)}
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 truncate font-medium">{selectedApp.name}</span>
                <span className="text-muted-foreground/30 shrink-0 text-[10px]">↕</span>
              </>
            )}
          </button>
        )}

        {/* Admin link */}
        {user?.role === "admin" && (
          <Link
            href="/admin"
            title={collapsed ? "Admin" : undefined}
            className={[
              "flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            ].join(" ")}
          >
            <Settings2 size={14} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && "Admin"}
          </Link>
        )}

        {/* Theme + User row */}
        <div className={`flex items-center ${collapsed ? "flex-col gap-1.5 pt-1" : "gap-1 px-1"}`}>
          <ThemeToggle />
          {!collapsed && user && (
            <span className="flex-1 text-xs text-muted-foreground truncate px-1">
              {user.name || user.email}
            </span>
          )}
          {user && (
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/8 transition-colors"
            >
              <LogOut size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={
      <div
        className="shrink-0 h-screen border-r border-border bg-[hsl(var(--sidebar-bg))]"
        style={{ width: EXPANDED_W, minWidth: EXPANDED_W }}
      />
    }>
      <SidebarInner />
    </Suspense>
  );
}
