import { DatabaseState, Project } from "../types";

// Props every tab component receives from App via {...shared}.
// One interface for all tabs; each tab destructures the subset it uses.
// Grows only when a newly split tab needs another shared symbol.
export interface SharedProps {
  state: DatabaseState;
  setState: (s: any) => void;
  currentUser: any;
  t: (s: string) => string;
  lang: string;
  rtl: boolean;
  formatUSD: (val: number) => string;
  formatIn: (val: number, currency: string) => string;
  refreshState: () => Promise<void>;
  triggerToast: (msg: string, typ?: "success" | "error") => void;
  handleNavClick: (tab: string) => void;
  openDoc: (d: { id: string; filename?: string; mimeType?: string }) => void;
  // Banking list controls — global search jumps into banking with these pre-filled
  bankFilterAcc: string;
  setBankFilterAcc: (v: string) => void;
  bankSearch: string;
  setBankSearch: (v: string) => void;
  // Projects the active user may raise requests against (role-scoped)
  requestableProjects: Project[];
  isProjectOfficer: boolean;
  isSelfService: boolean;
  // LAN access info fetched alongside state (dashboard's phone panel)
  phoneAccess: { urls: { iface: string; url: string }[]; qr: string | null } | null;
  // Contract generation + party files — shared by payroll (employees) and vendors
  contractFor: any;
  setContractFor: (v: any) => void;
  contractParty: "employee" | "vendor";
  setContractParty: (v: "employee" | "vendor") => void;
  contractForm: any;
  setContractForm: (v: any) => void;
  contractBusy: boolean;
  handleGenerateContract: (e: any, partyId: string, partyType?: "employee" | "vendor") => Promise<void>;
  partyFileFor: any;
  setPartyFileFor: (v: any) => void;
  renderPartyFile: (partyId: string, partyName: string) => any;
  // FX rate inputs — seeded by refreshState, edited in compliance, shown in sidebar footer
  eurRateInput: string;
  setEurRateInput: (v: string) => void;
  lbpRateInput: string;
  setLbpRateInput: (v: string) => void;
  // Global header search term — expenses voucher list also filters by it
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  // Opens the App-owned voucher detail drawer
  setDrawerExpenseId: (id: string | null) => void;
  // Upload a document against a voucher — used by expenses list and the drawer
  handleVoucherDocUpload: (ev: any, expenseId: string, voucherNo: string, kind?: string) => Promise<void> | void;
  // Project selection — set by the gaps drawer jump; App effect scrolls workspaceRef into view
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  // A record another screen asked to open (My Desk → Editorial desk). The tab clears it once used.
  /** Every project the viewer may see, any status — the Projects door's own list. */
  visibleProjects: any[];
  focusId: string | null;
  setFocusId: (id: string | null) => void;
  // Open another door, optionally on one record (Live editor → Editorial desk). The redirect
  // effect in App.tsx still refuses a door this role cannot open.
  openDoor: (door: string, focus?: string) => void;
  workspaceRef: any;
}

/* ── Telling an outsider something, over WhatsApp ─────────────────────────────
 * Suppliers, freelancers and clients never install this system, and WhatsApp is how
 * they are actually reached ([[anahon-notifications-decision]] part 3). A wa.me link
 * opens WhatsApp with the message already written; a person reads it and presses Send.
 * That is the whole design: no Business API, no approved templates, no verification, no
 * cost — and a human in the loop, which is the same rule the rest of the system follows
 * about never sending on someone's behalf.
 *
 * These are the helper and the wording only. The buttons belong to the screens that know
 * which record is in hand: Buying & paying (a paid voucher), Projects & funding (a
 * quotation or a balance), People (a timesheet or an invoice).
 */

/**
 * A wa.me link, or null when the number cannot be dialled internationally.
 *
 * wa.me takes digits only, in full international form — no +, no spaces, no leading 00.
 * A number stored without a country code cannot be turned into one by guessing, and a
 * wrong guess opens a chat with a stranger, so those return null and the caller hides
 * the button rather than offering a link that misdelivers.
 */
export function waLink(phone: string, text: string): string | null {
  const raw = String(phone || "").trim();
  if (!raw) return null;
  const international = raw.startsWith("+") || raw.startsWith("00");
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  // 8 is the shortest national number that could carry a country code and still dial.
  // ponytail: no default country — add one here if every record turns out to be Lebanese.
  if (!digits || digits.length < 8) return null;
  if (!international && digits.startsWith("0")) return null;   // a national trunk prefix: country unknown
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Put the values into a translated sentence. The placeholders survive translation. */
const fill = (s: string, p: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? `{${k}}`);

/**
 * The four messages, each already ending "— AnaHon" so the reader knows who wrote it.
 * The whole sentence is one i18n key rather than stitched fragments: Arabic puts the
 * pieces in a different order, and stitching would produce word salad.
 */
export const WA_TEMPLATES = {
  /** A voucher has been paid. Buying & paying. */
  "supplier-paid": (t: (s: string) => string, p: { name: string; voucherNo: string; amount: string; date: string }) =>
    fill(t("Hello {name}, we have paid voucher {voucherNo}, {amount}, on {date}. Please confirm receipt. — AnaHon"), p),
  /** A quotation has gone out. Projects & funding. */
  "client-quotation": (t: (s: string) => string, p: { name: string; ref: string; amount: string }) =>
    fill(t("Hello {name}, we have sent you quotation {ref} for {amount}. Tell us if anything should change. — AnaHon"), p),
  /** Money is still owed on it. Projects & funding. */
  "client-balance": (t: (s: string) => string, p: { name: string; amount: string; date: string }) =>
    fill(t("Hello {name}, a balance of {amount} is outstanding since {date}. Could you let us know when it will be settled? — AnaHon"), p),
  /** A timesheet or an invoice has not arrived. People. */
  "freelancer-nudge": (t: (s: string) => string, p: { name: string; what: string; period: string }) =>
    fill(t("Hello {name}, we are still waiting for your {what} for {period}. Send it when you can so payment is not held up. — AnaHon"), p),
  /**
   * A networking follow-up that was promised. Projects & funding (the Follow-up owed list).
   *
   * The name and nothing else, deliberately. `NetworkContact.followUp` ("propose AnaHon as
   * trainer") is our own note about the person, not a sentence to put in front of them; and
   * `metAt` is optional, so a "we met at {where}" opener renders "we met at  and said…" for
   * every contact the field is empty on. What is left has to hold on its own, because the
   * sender may press Send without reading it: an opener that is true of everyone in the
   * register, and that they edit in WhatsApp when they want to say more.
   */
  "contact-followup": (t: (s: string) => string, p: { name: string }) =>
    fill(t("Hello {name}, following up on our conversation as we agreed. Would you have a few minutes this week? — AnaHon"), p),
};

export type WaTemplateKey = keyof typeof WA_TEMPLATES;
