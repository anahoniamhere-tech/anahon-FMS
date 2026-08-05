import { DatabaseState, AppDoc } from "../types";

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
}
