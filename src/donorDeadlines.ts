/**
 * Donor reporting obligations, read out of the signed agreements.
 *
 * Every reporting date on the projects screen used to be manufactured: the timeline
 * generator wrote "Final report submitted to the donor" at end date + one month for
 * every grant, whatever the agreement said, and marked it Done as soon as any file
 * with "report" in its category was on the project. TRF therefore read as reported
 * and on time while its final financial report was ten weeks late.
 *
 * These rows replace that guess for the grants whose agreement has been read. Each one
 * names the document it came from, so any date here can be checked against the paper.
 * Nothing is inferred from a project's dates: where the agreement is missing, the
 * deadline is UNKNOWN and says so — a blank would read as "nothing due".
 */

export type Obligation = {
  projectId: string;
  /** Stable per project — the ProjectActivity id is act-doc-<projectId>-<key>. */
  key: string;
  title: string;
  /** What the document actually says, and what evidence closes it. */
  detail: string;
  /** ISO date, or "" when the agreement does not give one (see `unknown`). */
  due: string;
  /** True when no date exists to record — the row says so instead of sitting blank. */
  unknown?: boolean;
  /** Done only where there is evidence, named in `detail`. */
  done?: boolean;
  /** The file or message the date was read from. */
  source: string;
};

export const UNKNOWN_DUE = "deadline unknown";

export const DONOR_OBLIGATIONS: Obligation[] = [
  // ── Asfari Foundation — LER 2026 ────────────────────────────────────────────
  // Grant Offer: "Grant Period … ending on 30 April 2027"; "Submit an End of Year
  // (Final) Progress Report: by 31 May 2027".
  {
    projectId: "proj-asfari-ler", key: "final-report",
    title: "End of Year (Final) Progress Report — narrative + financial",
    detail: "Submitted on the Asfari Foundation Partner Reporting Platform. The Grant Period itself ends 30 April 2027; the report is due a month later.",
    due: "2027-05-31",
    source: "ASFARI-2026-LER/Agreement/AnaHon_Media_Asfari_Grant_Offer.docx"
  },
  {
    // The condition, not a date: the Grant Offer blocks spending until the plan is approved.
    projectId: "proj-asfari-ler", key: "year-plan",
    title: "Year Plan approved — condition on spending any of the $10,000",
    detail: "Grant Offer: \"AnaHon Media will not begin disbursing the grant until the updated Year Plan has been submitted on the Asfari Foundation Partner Reporting Platform and approved by the Programmes Team.\" CLEARED: plan sent 5 June 2026, approved by Nada Hamad (Asfari) on 29 June 2026 — \"we approve the plan and have no further comments from our end\". The grant is spendable.",
    due: "2026-06-29", done: true,
    source: "Grant Offer §Special conditions + Asfari email thread \"Grant Agreement & Next Steps\", 29 Jun 2026"
  },

  // ── Thomson Reuters Foundation ─────────────────────────────────────────────
  // Amendment 001 replaces Annex A's reporting clause with a two-row schedule.
  {
    projectId: "proj-trf", key: "interim-1",
    title: "First Interim report",
    detail: "Annex A as amended: \"15th of March 2026 — First Interim report\". Filed: TRF_Partner_Interim_Report_Anahon_Updated_April_2026.docx — delivered, though after the date on the schedule.",
    due: "2026-03-15", done: true,
    source: "TRF-2025-IMS/Agreement/Sub Grant Amendment 001- Anahon TRF signed.pdf"
  },
  {
    projectId: "proj-trf", key: "final-report",
    title: "Second and Final report — narrative filed, FINANCIAL STILL OUT",
    detail: "Annex A as amended: \"30th of June 2026 — Second and Final report\". The narrative is filed (TRF_Partner_Final_Report_Anahon_June_2026.docx); the financial side is not delivered — final invoice 04/2026 is written but unsent, and Annex A caps the grant at $10,000, so the defensible figure is $4,970.57, not $4,990.57. This is AnaHon's most overdue REPORTING obligation (the older unmet item is Asfari 2024's partner video).",
    due: "2026-06-30",
    source: "TRF-2025-IMS/Agreement/Sub Grant Amendment 001- Anahon TRF signed.pdf"
  },

  // ── SKF MediaMig — the agreement itself is gone ────────────────────────────
  {
    projectId: "proj-skf-mediamig", key: "reporting-unknown",
    title: "Reporting schedule UNKNOWN — the signed agreement is missing",
    detail: "AppDoc doc-mm-agreement points at SKF-2026-MEDIAMIG/Agreement/Acte_Retrocession_SKF-AH-09-2026_signed.docx, which does not exist in the vault (an August 2026 loss). The folder holds only two digitised vouchers. No reporting date can be stated until SKF re-sends the signed acte — this is not 'no reports due', it is 'we do not know'.",
    due: "", unknown: true,
    source: "no agreement on file — request sent to SKF"
  },

  // ── MADA — Content Creators Program ────────────────────────────────────────
  {
    projectId: "proj-1785584153305", key: "reporting-unknown",
    title: "Reporting schedule UNKNOWN — no agreement document at all",
    detail: "No grant agreement, contract or award letter for MADA exists anywhere in the vault. Reporting obligations, payment conditions and the end date all rest on a document AnaHon does not hold.",
    due: "", unknown: true,
    source: "no agreement on file — request to be sent to MADA"
  },

  // ── FPU Voices Unseen — closed, recorded for the archive ───────────────────
  {
    projectId: "proj-fpu-vu", key: "progress-report",
    title: "Narrative progress + financial report (period 18 Aug – 18 Nov 2025)",
    detail: "The subgrant's schedule prints the deadline as \"December 15, 2026\" — but the period it covers ended 18 Nov 2025 and the FINAL report was due 18 Mar 2026, so the sequence implies 15 Dec 2025. Recorded as the document prints it; the discrepancy is the agreement's, not ours, and is left uncorrected. Treated as delivered and approved: tranche 2 (EUR 9,028) landed 7 Jan 2026, and the agreement pays it only \"within two weeks after approval\" of this report.",
    due: "2026-12-15", done: true,
    source: "FPU-2025-SUBGRANT/Agreement/FPU-Anahon Subgrant for countersignature.pdf"
  },
  {
    projectId: "proj-fpu-vu", key: "final-report",
    title: "Final narrative + financial reports (period 18 Aug 2025 – 18 Feb 2026)",
    detail: "Deadline 18 March 2026. Delivered: Voices_Unseen_Final_Report_Anahon_v4 plus FPU_Corrected_Financial_reporting_Anahon.xlsx, and the final instalment arrived 2 July 2026 — which the agreement pays only after FPU approves this report.",
    due: "2026-03-18", done: true,
    source: "FPU-2025-SUBGRANT/Agreement/FPU-Anahon Subgrant for countersignature.pdf"
  },
  // ── Asfari Foundation 2024 — the Performance Excellence Grant (£7,000) ─────
  {
    projectId: "proj-asfari-2024", key: "final-report",
    title: "Final Report (End of Grant Report)",
    detail: "Grant Offer: \"Submit a Final Report: by 11 July 2025\"; the Grant Period ran to 2 June 2025. Asfari extended the deadline to 31 July 2025 for all partners, and Saad confirmed submission on 5 August 2025 — delivered, after both dates. No report document is filed against the project in the vault; the evidence is the email confirmation.",
    due: "2025-07-11", done: true,
    source: "ASFARI-2024/Agreement/Anahon Media_PE Grant Agreement (2024)_FINAL.pdf + Asfari thread \"PEG End of Grant Report\", 5 Aug 2025"
  },
  {
    // The deliverable nobody was tracking, because the timeline only ever knew about reports.
    projectId: "proj-asfari-2024", key: "partner-video",
    title: "'Partner Experience' video — NOT DELIVERED",
    detail: "The same Grant Offer lists a second dated deliverable: \"Submit a 'Partner Experience' video: by 11 July 2025\" — a short film about AnaHon's experience of the grant, for the Foundation's network. On 5 August 2025 AnaHon sent Asfari a storyboard and said it was \"ready to begin production\"; nothing in the mail since shows the film was delivered. Open against a closed grant.",
    due: "2025-07-11",
    source: "ASFARI-2024/Agreement/Anahon Media_PE Grant Agreement (2024)_FINAL.pdf"
  },

  // ── SKF — Investigative Report (SKF-AH-06/2025) ────────────────────────────
  {
    projectId: "proj-skf-invj", key: "interim-narrative",
    title: "Interim Narrative Report (15–30 June 2025)",
    detail: "Section 5.02 Reporting Schedule: due 1 July 2025. Treated as delivered and accepted: §4.01(b) releases the second disbursement (25%) only on submission of the progress narrative by that date, and the money was received.",
    due: "2025-07-01", done: true,
    source: "SKF-2025-INVJ/Agreement/Grant Agreement_SKF-Anahon_MIIM Inv_June 2025-signed.pdf"
  },
  {
    projectId: "proj-skf-invj", key: "final-report",
    title: "Final Narrative and Financial Reports (15 Jun – 31 Aug 2025)",
    detail: "Section 5.02 Reporting Schedule: due 10 September 2025. Filed: Anahon_Final Narrative Report_Sept 2025.docx and Annex 2 - Financial Report - AnaHon.xlsx; §4.01(c) releases the final 15% only against them. Note for the audit: §5 requires records to be kept for three years from the date the final expenditure report was submitted.",
    due: "2025-09-10", done: true,
    source: "SKF-2025-INVJ/Agreement/Grant Agreement_SKF-Anahon_MIIM Inv_June 2025-signed.pdf"
  },

  // ── Basmeh & Zeitooneh — FRL small grant ───────────────────────────────────
  {
    projectId: "proj-bwz-frl", key: "final-report",
    title: "Final financial + narrative report",
    detail: "The agreement gives 15/04/2023–15/09/2023 as implementation and 16/09/2023–30/09/2023 as \"the period for submitting all reports and wrapping up the project\", with the final financial report and its supporting documents due \"15 days after the completion of the project. 30/09/2023\". Monthly financial reports were also due on the fifth of each month during implementation; those are not separately filed. A Financial Report row exists on the project, but its file is one of the August 2026 vault casualties — the obligation was met, the paper is gone.",
    due: "2023-09-30", done: true,
    source: "BWZ-2023-FRL/Contract/agreements ana hon.pdf (Clause 4, Time frame) + BWZ-2023-FRL/Agreement/CSEU - CBOs Agreement (AnaHon-bwz).docx"
  },

  // ── FPU iContent 2 — no agreement in the vault ─────────────────────────────
  {
    projectId: "proj-fpu-icontent2", key: "reporting-unknown",
    title: "Reporting schedule UNKNOWN — no agreement on file (reports delivered)",
    detail: "The vault holds only a budget workbook and reconstructed vouchers for this grant; the subgrant contract (2WWEU21/50675/23057) is nowhere, so no due date can be stated. What is known: the final financial and narrative reports were delivered — Emilie Bisson of Free Press Unlimited acknowledged them on 8 April 2024 (\"Many thanks for the report\"). The obligation was met; the schedule it was measured against is not on record.",
    due: "", unknown: true, done: true,
    source: "no agreement on file — FPU thread \"Final_financial_report\", 8 Apr 2024"
  }
];

/** The projects whose obligations are document-sourced — the generator leaves these alone. */
export const DOCUMENTED_PROJECT_IDS = [...new Set(DONOR_OBLIGATIONS.map(o => o.projectId))];

export const obligationId = (o: Obligation) => `act-doc-${o.projectId}-${o.key}`;

/** How a due date reads on screen: a real date, or the words — never blank. */
export function dueLabel(o: { dueDate?: string; detail?: string }): string {
  return o.dueDate || UNKNOWN_DUE;
}

/**
 * Open obligations already past their date, worst first. An obligation with no date
 * cannot be overdue — it is unknown, which is a different problem and is surfaced as one.
 */
export function overdueObligations<T extends { dueDate: string; status: string }>(rows: T[], today: string): T[] {
  return rows
    .filter(r => r.status !== "Done" && r.status !== "Cancelled" && !!r.dueDate && r.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Whole days late, for "74 days overdue". */
export function daysLate(due: string, today: string): number {
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(due)) / 86400000));
}
