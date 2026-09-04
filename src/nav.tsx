import React from "react";
import {
  Activity, BookOpen, Briefcase, Building, Coins, FileText, FolderGit2, HardDrive, Layers,
  Newspaper, Share2, ShieldAlert, Sliders, User, UserCheck, Users,
} from "lucide-react";

/**
 * The sidebar, as data. Eight doors, grouped by the job a person does.
 *
 * Every screen the system has appears here exactly once (scripts/check-nav.ts proves
 * it against App.tsx). Who sees a door is decided by `roles` on the section, or on an
 * item when it differs from its section; an omitted `roles` means everyone.
 *
 * Phase 1 of the 4 Sep 2026 navigation decision: regroup and rename only. No screen
 * was added, removed, or changed, and no role gained or lost a screen except that the
 * Help page and the Policies now show to everyone who is bound by them.
 */
export type NavItem = {
  navKey: string;
  label: string;                 // English source string; i18n.ts carries the Arabic
  icon: React.ReactNode;
  roles?: string[];              // overrides the section's roles when set
  badge?: "expenses" | "compliance";
};
export type NavSection = { section: string; roles?: string[]; items: NavItem[] };

const ic = (I: React.ComponentType<{ className?: string }>) => <I className="h-4 w-4 shrink-0" />;
const glyph = (g: string) => <span className="h-4 w-4 shrink-0 text-center leading-4">{g}</span>;

// Role groups, matching the checks the server makes.
import { CREW, EDITORS, PLO as PLO_SEAT, DIGITAL as DIGITAL_SEAT, SELF as SELF_SEAT } from "./roles";
export { CREW, EDITORS };
export const OFFICER = ["Project Officer"];
export const SELF = [SELF_SEAT];
export const PLO = [PLO_SEAT];
export const DIGITAL = [DIGITAL_SEAT];
// The people who run the organisation's books and records: everyone who is not in one
// of the restricted groups above. Named by exclusion on purpose — a role that is not
// yet placed lands here, never in the dark. The server trims what it sends anyway.
export const isRestricted = (role: string) => [...CREW, ...OFFICER, ...SELF, ...EDITORS, ...PLO, ...DIGITAL].includes(role);

export const NAV: NavSection[] = [
  {
    section: "Home",
    items: [
      { navKey: "mydesk", label: "My Desk", icon: ic(UserCheck), roles: ["*full", ...EDITORS, ...PLO, ...DIGITAL] },
      { navKey: "dashboard", label: "Organisation overview", icon: ic(Activity), roles: ["*full", ...OFFICER] },
      { navKey: "help", label: "Help & Q&A", icon: glyph("?") },
      { navKey: "handbooks", label: "Policies & handbooks", icon: ic(BookOpen) },
    ],
  },
  {
    section: "Editorial",
    roles: ["*full", ...OFFICER, ...CREW, ...EDITORS, ...DIGITAL],
    items: [
      { navKey: "editorial", label: "Editorial desk", icon: ic(Newspaper), roles: ["*full", ...OFFICER, ...CREW, ...EDITORS] },
      { navKey: "social", label: "Social desk", icon: glyph("📣"), roles: ["*full", ...EDITORS, ...DIGITAL] },
    ],
  },
  {
    section: "Website & systems",
    roles: ["*full", ...EDITORS, ...DIGITAL],
    items: [
      { navKey: "live", label: "Live editor", icon: glyph("✎") },
      { navKey: "website", label: "Site content", icon: glyph("🌐") },
      { navKey: "archive", label: "Media archive", icon: glyph("🗂") },
      { navKey: "tools", label: "Tools", icon: ic(Sliders), roles: ["*full", ...DIGITAL] },
    ],
  },
  {
    section: "Projects & funding",
    roles: ["*full", ...OFFICER, ...PLO, ...DIGITAL, ...EDITORS],
    items: [
      { navKey: "projects", label: "Projects & donors", icon: ic(FolderGit2), roles: ["*full", ...OFFICER, ...PLO] },
      { navKey: "funnel", label: "Funding pipeline", icon: ic(Layers), roles: ["*full"] },
      { navKey: "production", label: "Clients & quotations", icon: ic(Briefcase), roles: ["*full"] },
      { navKey: "network", label: "Contacts", icon: ic(Share2), roles: ["*full", ...PLO, ...DIGITAL] },
    ],
  },
  {
    section: "Buying & paying",
    roles: ["*full", ...OFFICER, ...PLO],
    items: [
      { navKey: "procurement", label: "Quotes & bids", icon: ic(Layers) },
      { navKey: "vendors", label: "Suppliers", icon: ic(Users), roles: ["*full", ...PLO] },
      { navKey: "expenses", label: "Payment requests", icon: ic(FileText), badge: "expenses" },
      { navKey: "assets", label: "Equipment", icon: ic(HardDrive), roles: ["*full", ...PLO] },
    ],
  },
  {
    section: "Books",
    roles: ["*full"],
    items: [
      { navKey: "banking", label: "Bank & cash", icon: ic(Coins) },
      { navKey: "ledger", label: "Ledger", icon: ic(Building) },
      { navKey: "accounts", label: "Chart of accounts", icon: ic(Sliders) },
      { navKey: "partners", label: "Owners' capital", icon: ic(Briefcase) },
      { navKey: "reports", label: "Financial reports", icon: ic(FileText) },
    ],
  },
  {
    section: "People",
    roles: ["*full", ...SELF, ...EDITORS, ...PLO, ...DIGITAL],
    items: [
      { navKey: "payroll", label: "Timesheets & payroll", icon: ic(User) },
    ],
  },
  {
    section: "Admin",
    roles: ["*full"],
    items: [
      { navKey: "compliance", label: "Team, rates & audit log", icon: <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />, badge: "compliance" },
    ],
  },
];

/** "*full" in a roles list means every role that is not restricted. */
const allows = (roles: string[] | undefined, role: string) =>
  !roles || roles.includes(role) || (roles.includes("*full") && !isRestricted(role));

/** The sections and items this role sees, in order; empty sections drop out. */
export function visibleNav(role: string): NavSection[] {
  return NAV
    .map(s => ({ ...s, items: s.items.filter(i => allows(i.roles ?? s.roles, role)) }))
    .filter(s => s.items.length > 0);
}

export const NAV_KEYS = NAV.flatMap(s => s.items.map(i => i.navKey));

/** Where a restricted role lands when it opens the system or strays onto a door it cannot see. */
export const LANDING: Record<string, string> = {
  "Employee (Self-Service)": "payroll",
  "Project Officer": "expenses",
  "Reporter": "editorial", "Content Creator": "editorial", "Podcaster": "editorial", "Graphic Designer": "editorial",
  "Chief Editor": "editorial", "Production Manager": "editorial",
  "Procurement and Logistics Officer": "expenses",
  "Digital Officer": "live",
};
