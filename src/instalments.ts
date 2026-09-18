/**
 * Donor instalments and the letter that asks for one (Saad, 18 Sep 2026).
 *
 * A grant is paid in tranches against conditions the agreement sets out. The schedule lives on the
 * record beside the workplan (src/workplan.ts), so the letter, the workplan's milestones and the
 * project's own rows all say the same thing. The letter is a generated document on AnaHon's
 * letterhead — never a paragraph retyped into an email.
 *
 * The bank details are carried on the record as they are written in the signed agreement, with the
 * agreement named as their source: a donor pays what its own paper says, and retyping an account
 * number from memory is how money goes missing.
 */

export type Instalment = {
  /** 1, 2, 3 — the order the agreement sets. */
  no: number;
  /** Share of the grant, as the agreement states it. */
  percent: number;
  amount: number;
  /** What has to be true before it is paid, in the agreement's own terms. */
  condition: string;
  /** When the condition falls due, where the agreement gives a date. */
  dueDate?: string;
  /** What we have seen of it: "" (not asked), "requested", or "received". */
  status?: string;
};

export type PayeeBank = {
  accountName: string; bankName: string; branch?: string;
  accountNo?: string; iban?: string; swift?: string;
  /** Where these lines were read from — printed on the letter. */
  source: string;
};

/** The reference the letter carries, and the FMS keeps: one per project per instalment. */
export function requestRef(projectCode: string, no: number): string {
  const code = String(projectCode || "").trim();
  if (!code || !(no >= 1)) throw new Error("An instalment request needs a project code and a number.");
  return `${code}/INST-${no}`;
}

/** The instalment being asked for, or null. */
export function instalmentNo(list: Instalment[], no: number): Instalment | null {
  return (list || []).find(i => i.no === no) || null;
}

/** The next one to ask for: the lowest that has not been requested or received. */
export function nextInstalment(list: Instalment[]): Instalment | null {
  return [...(list || [])].sort((a, b) => a.no - b.no).find(i => !i.status) || null;
}

/**
 * What stops this request going out. Deliberately arithmetic, not judgement: the schedule has to add
 * up to the grant, because a letter that asks for a share of the wrong total is worse than no letter.
 */
export function instalmentBlocker(list: Instalment[], no: number, grantAmount: number, bank: PayeeBank | null): string | null {
  const one = instalmentNo(list, no);
  if (!one) return `This project has no instalment ${no} on its record.`;
  if (!(one.amount > 0)) return `Instalment ${no} has no amount on the record.`;
  if (!bank || !bank.accountName || !bank.bankName || !(bank.iban || bank.accountNo)) {
    return "The account the donor pays into is not on the record yet — take it from the signed agreement, never from memory.";
  }
  const sum = Math.round((list.reduce((s, i) => s + (Number(i.amount) || 0), 0)) * 100) / 100;
  if (grantAmount > 0 && Math.abs(sum - grantAmount) > 0.5) {
    return `The instalments on the record add up to ${sum}, but the grant is ${grantAmount}. Fix the schedule before asking for money.`;
  }
  const pct = list.reduce((s, i) => s + (Number(i.percent) || 0), 0);
  if (pct && Math.abs(pct - 100) > 0.5) return `The instalment percentages add up to ${pct}%, not 100%.`;
  if (one.status === "received") return `Instalment ${no} is already recorded as received.`;
  return null;
}

/** "30% of EUR 12,000" — the way the agreement itself puts it. */
export function shareLabel(one: Instalment, currency: string, grantAmount: number): string {
  return one.percent
    ? `${one.percent}% of ${currency} ${grantAmount.toLocaleString()}`
    : `${currency} ${one.amount.toLocaleString()}`;
}
