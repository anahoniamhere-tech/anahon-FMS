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
  workspaceRef: any;
}
