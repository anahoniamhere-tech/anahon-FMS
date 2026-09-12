import React from "react";
import {
  Activity, Archive, BookOpen, Briefcase, Building, Coins, FileText, FolderGit2, HardDrive,
  Layers, LayoutGrid, Newspaper, PencilLine, RefreshCw, Share2,
  ShieldAlert, Sliders, User, UserCheck, Users,
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

// Exported so panel headings draw the same icons the tabs do — one icon style app-wide.
// `size` exists only for 10–11px chips, where a 16px icon would outweigh the text.
export const ic = (I: React.ComponentType<{ className?: string }>, size = "h-4 w-4") => <I className={`${size} shrink-0`} />;
const glyph = (g: string) => <span className="h-4 w-4 shrink-0 text-center leading-4">{g}</span>;

// Role groups, matching the checks the server makes.
import { ALL_ROLES, CREW, EDITORS, RESTRICTED, PLO as PLO_SEAT, DIGITAL as DIGITAL_SEAT, SELF as SELF_SEAT } from "./roles";
export { CREW, EDITORS };
export const OFFICER = ["Project Officer"];
export const SELF = [SELF_SEAT];
export const PLO = [PLO_SEAT];
export const DIGITAL = [DIGITAL_SEAT];
// The people who run the organisation's books and records: everyone who is not in one
// of the restricted groups above. Named by exclusion on purpose — a role that is not
// yet placed lands here, never in the dark. The server trims what it sends anyway.
export const isRestricted = (role: string) => RESTRICTED.includes(role);

export const NAV: NavSection[] = [
  {
    section: "Home",
    items: [
      { navKey: "doors", label: "Doors", icon: ic(LayoutGrid) },
      { navKey: "mydesk", label: "My Desk", icon: ic(UserCheck) },
      { navKey: "dashboard", label: "Organisation overview", icon: ic(Activity), roles: ["*full", ...OFFICER] },
      { navKey: "help", label: "Help & Q&A", icon: glyph("?") },
      { navKey: "handbooks", label: "Policies & handbooks", icon: ic(BookOpen) },
    ],
  },
  {
    section: "Editorial",
    roles: ["*full", ...OFFICER, ...CREW, ...EDITORS, ...DIGITAL],
    items: [
      // One door, 12 Sep 2026: the piece is the unit of work and the website, Facebook and
      // Instagram are its channels, so the Social desk folded into this screen. The navKey stays
      // "editorial" on purpose — workflow.ts routes its editorial rules to door "editorial", and
      // that file belongs to Home & desk. The Digital Officer joins the door they used to reach
      // through "social"; the server already sends them every content item, and /api/content/* is
      // still not in DIGITAL_ALLOWED_POSTS, so they see the register and work the channels only.
      { navKey: "editorial", label: "Newsroom", icon: ic(Newspaper), roles: ["*full", ...OFFICER, ...CREW, ...EDITORS, ...DIGITAL] },
    ],
  },
  {
    section: "Website & systems",
    roles: ["*full", ...EDITORS, ...DIGITAL],
    items: [
      { navKey: "live", label: "Live editor", icon: ic(PencilLine) },
      { navKey: "archive", label: "Media archive", icon: ic(Archive) },
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
      { navKey: "subscriptions", label: "Subscriptions & renewals", icon: ic(RefreshCw), roles: ["*full", ...PLO] },
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
      { navKey: "compliance", label: "Team, rates & audit log", icon: ic(ShieldAlert), badge: "compliance" },
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

/** Everyone opens on the doors (5 Sep 2026); it is also where a role lands after straying onto a door it cannot see. */
export const LANDING: Record<string, string> = Object.fromEntries(ALL_ROLES.map(r => [r, "doors"]));
