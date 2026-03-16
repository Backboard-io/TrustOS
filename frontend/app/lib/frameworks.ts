/**
 * Compliance module registry.
 *
 * To add a new compliance framework (e.g. FedRAMP, ISO 27001, PCI-DSS):
 *   1. Add one entry to COMPLIANCE_FRAMEWORKS below.
 *   2. Create any framework-specific pages under app/[framework-id]/.
 *   3. Done — the nav, sub-nav, and controls filter all update automatically.
 */

export type FrameworkColor = "blue" | "emerald" | "violet" | "amber" | "rose";

export type FrameworkLink = {
  href: string;
  label: string;
  /** Match only the exact path (ignore sub-paths) */
  exact?: boolean;
};

export type ComplianceFramework = {
  /** Stable internal ID — never changes */
  id: string;
  /** Full display name */
  label: string;
  /** Compact label for the tab pill */
  shortLabel: string;
  /** One-line descriptor shown in tooltips / future module picker */
  description: string;
  /** Accent color for the tab and sub-nav */
  color: FrameworkColor;
  /** The framework value passed as ?framework= on shared pages like /controls */
  catalogKey: string;
  /** Where clicking the module tab navigates to */
  overviewHref: string;
  /**
   * URL path prefixes that activate this module's sub-nav.
   * A page is "in" this module when:
   *   - its pathname starts with one of these prefixes, OR
   *   - its ?framework= query param matches catalogKey
   */
  activePaths: string[];
  /** Sub-nav links rendered in the module bar */
  subNav: FrameworkLink[];
};

export const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: "soc2",
    label: "SOC 2 TSC",
    shortLabel: "SOC 2",
    description: "AICPA Trust Services Criteria",
    color: "blue",
    catalogKey: "SOC2-TSC",
    overviewHref: "/controls?framework=SOC2-TSC",
    activePaths: [],           // activated only via ?framework=SOC2-TSC
    subNav: [
      { href: "/controls?framework=SOC2-TSC", label: "Controls" },
      { href: "/posture?framework=SOC2-TSC",  label: "Posture" },
      { href: "/history?framework=SOC2-TSC",  label: "History" },
      { href: "/evidence?framework=SOC2-TSC", label: "Evidence" },
    ],
  },
  {
    id: "hipaa",
    label: "HIPAA Security Rule",
    shortLabel: "HIPAA",
    description: "45 CFR Part 164, Subpart C",
    color: "emerald",
    catalogKey: "HIPAA-Security-Rule",
    overviewHref: "/hipaa",
    activePaths: ["/hipaa"],
    subNav: [
      { href: "/hipaa",                                   label: "Overview",       exact: true },
      { href: "/controls?framework=HIPAA-Security-Rule",         label: "Controls" },
      { href: "/posture?framework=HIPAA-Security-Rule",          label: "Posture" },
      { href: "/hipaa/phi-assets",                         label: "PHI Assets" },
      { href: "/hipaa/baa",                                label: "BAA Vendors" },
      { href: "/hipaa/training",                           label: "Training" },
      { href: "/hipaa/risk-assessments",                   label: "Risks" },
      { href: "/hipaa/incidents",                          label: "Incidents" },
      { href: "/hipaa/contingency",                        label: "Contingency" },
      { href: "/hipaa/access-reviews",                     label: "Access Reviews" },
      { href: "/hipaa/policies",                           label: "Policies" },
    ],
  },
  // ── Future modules (uncomment + fill in when ready) ─────────────────────
  // {
  //   id: "fedramp",
  //   label: "FedRAMP Moderate",
  //   shortLabel: "FedRAMP",
  //   description: "NIST SP 800-53 Rev 5",
  //   color: "violet",
  //   catalogKey: "FedRAMP-Moderate",
  //   overviewHref: "/controls?framework=FedRAMP-Moderate",
  //   activePaths: [],
  //   subNav: [
  //     { href: "/controls?framework=FedRAMP-Moderate", label: "Controls" },
  //     { href: "/posture", label: "Posture" },
  //   ],
  // },
  // {
  //   id: "iso27001",
  //   label: "ISO 27001",
  //   shortLabel: "ISO 27001",
  //   description: "Information security management",
  //   color: "amber",
  //   catalogKey: "ISO27001",
  //   overviewHref: "/controls?framework=ISO27001",
  //   activePaths: [],
  //   subNav: [
  //     { href: "/controls?framework=ISO27001", label: "Controls" },
  //     { href: "/posture", label: "Posture" },
  //   ],
  // },
];

// ── Color tokens per accent ───────────────────────────────────────────────

export type ColorTokens = {
  tab: string;
  tabActive: string;
  subNavBar: string;
  linkActive: string;
  linkInactive: string;
  badge: string;
};

export const COLOR_TOKENS: Record<FrameworkColor, ColorTokens> = {
  blue: {
    tab:         "text-muted-foreground hover:text-bb-blue hover:bg-bb-blue/10 transition-colors",
    tabActive:   "bg-bb-blue text-white shadow-sm",
    subNavBar:   "bg-blue-50/60 dark:bg-blue-950/25 border-bb-blue/15",
    linkActive:  "bg-bb-blue/10 text-bb-blue font-medium",
    linkInactive:"text-muted-foreground hover:text-foreground hover:bg-muted/60",
    badge:       "bg-bb-blue/10 text-bb-blue",
  },
  emerald: {
    tab:         "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors",
    tabActive:   "bg-emerald-600 text-white shadow-sm",
    subNavBar:   "bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-500/15",
    linkActive:  "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-medium",
    linkInactive:"text-muted-foreground hover:text-foreground hover:bg-muted/60",
    badge:       "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  },
  violet: {
    tab:         "text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10 transition-colors",
    tabActive:   "bg-violet-600 text-white shadow-sm",
    subNavBar:   "bg-violet-50/60 dark:bg-violet-950/25 border-violet-500/15",
    linkActive:  "bg-violet-500/12 text-violet-700 dark:text-violet-300 font-medium",
    linkInactive:"text-muted-foreground hover:text-foreground hover:bg-muted/60",
    badge:       "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  },
  amber: {
    tab:         "text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors",
    tabActive:   "bg-amber-600 text-white shadow-sm",
    subNavBar:   "bg-amber-50/60 dark:bg-amber-950/25 border-amber-500/15",
    linkActive:  "bg-amber-500/12 text-amber-700 dark:text-amber-300 font-medium",
    linkInactive:"text-muted-foreground hover:text-foreground hover:bg-muted/60",
    badge:       "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  },
  rose: {
    tab:         "text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors",
    tabActive:   "bg-rose-600 text-white shadow-sm",
    subNavBar:   "bg-rose-50/60 dark:bg-rose-950/25 border-rose-500/15",
    linkActive:  "bg-rose-500/12 text-rose-700 dark:text-rose-300 font-medium",
    linkInactive:"text-muted-foreground hover:text-foreground hover:bg-muted/60",
    badge:       "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
  },
};

/** Return the active framework given the current pathname + ?framework= param. */
export function detectActiveFramework(
  pathname: string,
  frameworkParam: string,
): ComplianceFramework | null {
  // Explicit ?framework= param wins first
  if (frameworkParam) {
    return COMPLIANCE_FRAMEWORKS.find((f) => f.catalogKey === frameworkParam) ?? null;
  }
  // Path-prefix match
  for (const fw of COMPLIANCE_FRAMEWORKS) {
    if (fw.activePaths.some((p) => pathname.startsWith(p))) {
      return fw;
    }
  }
  return null;
}
