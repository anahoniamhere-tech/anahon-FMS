/**
 * The organisation's own papers — the registration, the statute, the lease, the tax filings —
 * and the filed PDF pack of the policies.
 *
 * Two rules shaped this file.
 *
 * **The shelf is a written list, not a query.** The papers do not share a category: nineteen are
 * "Legal", the lease is "Contracts", the tax filings are "Tax_Regularization". Filtering by
 * category loses the lease and the filings; taking all of "Contracts" pulls in staff contracts.
 * So each paper is named here by its document id, in the order it should be read, with the one
 * line that says what it proves. Nothing is copied out of the vault — these are pointers to the
 * rows already filed.
 *
 * **A paper with no `proves` line is not a paper with a guessed one.** Five lines were drafted
 * from a filename and are left empty until Saad confirms them; the card simply shows no summary.
 */

/** A paper the organisation has to be able to produce on demand. */
export type Paper = {
  /** The document id already in the vault. Never a filename match — filenames repeat. */
  id: string;
  ref: string;
  title: string;
  /** The date on the paper itself, as the record shows it. Empty where the paper carries none. */
  date: string;
  /** What this paper proves, in one line. Empty = awaiting Saad; the card shows nothing. */
  proves: string;
  group: PaperGroup;
};

export const PAPER_GROUPS = ["Registration & identity", "Premises", "Website registration", "Tax"] as const;
export type PaperGroup = (typeof PAPER_GROUPS)[number];

export const PAPERS: Paper[] = [
  // ---- Registration & identity ------------------------------------------------
  { id: "doc-court-cert-ar", ref: "ANH-DOC-00394", date: "2023-10-12", group: "Registration & identity",
    title: "Court registration certificate 90/2023 (Arabic)",
    proves: "The court's own Arabic certificate that AnaHon is registered as civil company 90/2023." },
  { id: "doc-reg-cert-en", ref: "ANH-DOC-00310", date: "2023-10-12", group: "Registration & identity",
    title: "Registration certificate 90/2023, certified English",
    proves: "The certified English certificate of the company's registration — the one to give a donor or a foreign bank." },
  { id: "doc-1789654293478", ref: "ANH-DOC-00821", date: "2023-10-12", group: "Registration & identity",
    title: "Court registration certificate 90/2023 — Arabic and certified English",
    proves: "The bilingual certified copy — Arabic original and sworn English translation in one file." },
  { id: "doc-1789653353157", ref: "ANH-DOC-00817", date: "2023-10-12", group: "Registration & identity",
    title: "Court registration request, civil partnership 90/2023 — Arabic and certified English",
    proves: "The application AnaHon filed to be registered, showing what was declared to the court." },
  { id: "doc-1789647217629-c047", ref: "ANH-DOC-00796", date: "2023-10-13", group: "Registration & identity",
    title: "Civil company registration notice and certificate (Arabic, 2 pages)",
    proves: "The registration notice and certificate issued the day after the court entry." },
  { id: "doc-civil-license", ref: "ANH-DOC-00311", date: "", group: "Registration & identity",
    title: "Civil company licence", proves: "" },
  { id: "doc-1789654507974", ref: "ANH-DOC-00822", date: "2023-11-02", group: "Registration & identity",
    title: "Civil publication 14712/2023 and civil company licence — Arabic and certified English",
    proves: "The official publication of the registration, number 14712/2023 — proof it was published, not only filed." },
  { id: "doc-1789652359601", ref: "ANH-DOC-00814", date: "2023-09-30", group: "Registration & identity",
    title: "Constitutive statute, certified true copy (Arabic, 11 pages)",
    proves: "The complete certified true copy of the founding statute — use this one." },
  { id: "doc-statute-ar", ref: "ANH-DOC-00395", date: "2023", group: "Registration & identity",
    title: "Constitutive statute (Arabic, 11 pages)",
    proves: "The founding statute: what the company is, who manages it, how money is decided. The certified true copy above carries the same text." },
  { id: "doc-1789647217623-7a9a", ref: "ANH-DOC-00794", date: "2023-11-02", group: "Registration & identity",
    title: "Constitutive statute, certified true copy — page 1 only",
    proves: "The first page of the statute as a separate certified copy, for when only the front page is asked for." },
  { id: "doc-1789647217634-8145", ref: "ANH-DOC-00798", date: "2022-11-13", group: "Registration & identity",
    title: "ANAHON SARL incorporation bundle (Arabic)", proves: "" },
  { id: "doc-reg-cert-ar", ref: "ANH-DOC-00309", date: "2023-10-30", group: "Registration & identity",
    title: "Ministry of Finance registration certificate 3893185 (Arabic)",
    proves: "The Ministry of Finance certificate carrying AnaHon's tax number, 3893185." },
  { id: "doc-1789653177476", ref: "ANH-DOC-00816", date: "2023-10-30", group: "Registration & identity",
    title: "Ministry of Finance certificate 3893185 — Arabic and certified English",
    proves: "The bilingual certified copy of the tax-number certificate." },

  // ---- Premises ---------------------------------------------------------------
  { id: "doc-1789652819324", ref: "ANH-DOC-00815", date: "2025-07-15", group: "Premises",
    title: "Office lease, Tal 730/11 — Arabic original and certified translation",
    proves: "The lease on the office: USD 6,000 a year, from 15 July 2025." },
  { id: "doc-1789653708168", ref: "ANH-DOC-00818", date: "2023-09-30", group: "Premises",
    title: "Premises use declaration, notary 6083/2023", proves: "" },
  { id: "doc-1789653708218", ref: "ANH-DOC-00819", date: "2005-05-10", group: "Premises",
    title: "Property title, Basatin Tripoli 554/E/11", proves: "" },

  // ---- Website registration ---------------------------------------------------
  { id: "doc-1789647217629-5234", ref: "ANH-DOC-00797", date: "2022-06-13", group: "Website registration",
    title: "Website registration form (إستمارة علم وخبر)",
    proves: "The form filed to register anahon.org as a publication." },
  { id: "doc-1789647217627-160c", ref: "ANH-DOC-00795", date: "2022-08-05", group: "Website registration",
    title: "Website registration statement (افادة علم وخبر)",
    proves: "The statement issued on that filing." },
  { id: "doc-1789654115613", ref: "ANH-DOC-00820", date: "2022-08-05", group: "Website registration",
    title: "Website notice certificate NAC 97, anahon.org — Arabic and certified English",
    proves: "The certificate, number NAC 97, that anahon.org is a registered publication — the paper a press body asks for." },

  // ---- Tax --------------------------------------------------------------------
  { id: "doc-a-general-tax-regularization-2023-income-tax-declaration-filed-receipts-24", ref: "ANH-DOC-00371", date: "2024-07-18", group: "Tax",
    title: "2023 income tax declaration, as filed (receipts 245019055, LibanPost)",
    proves: "The 2023 income tax return as filed, with the LibanPost receipt proving the date it was lodged." },
  { id: "doc-a-general-tax-regularization-jad-maaliki-paid-audit-invoice-pdf", ref: "ANH-DOC-00372", date: "", group: "Tax",
    title: "Auditor's invoice, paid (Jad Maaliki)", proves: "" },
  { id: "doc-regpack-2026", ref: "ANH-DOC-00383", date: "2026-07-31", group: "Tax",
    title: "Tax regularisation evidence pack, FY2023–2026",
    proves: "Everything assembled for the tax regularisation: what was filed, what was paid, what is still open." },
];

/** The zip of all of them, filed 17 Sep 2026 — the shelf's "download everything" line. */
export const PAPERS_ZIP = { id: "doc-1789656185824", ref: "ANH-DOC-00824", date: "2026-09-17" };

/**
 * The filed PDF pack of the policies (ANH-DOC-00799–00812), rendered 17 Sep 2026 and filed in
 * GENERAL/Policies. A policy is shared from these, never from the .docx: the .docx cannot be
 * opened from a link, and this container has no way to turn one into a PDF.
 *
 * The pack is by handbook, not by policy — P1 and P2 travel together, P5 to P7 together. The
 * card says so, because a recipient asked for "the finance policy" receives three.
 *
 * When it was rendered is not written down here: the shelf reads it from the filed PDFs
 * themselves, so re-rendering the pack is the only thing anyone has to remember to do.
 */
export type PolicyPdf = {
  id: string; ref: string; label: string; policies: string[]; lang: "en" | "ar";
  /** The live handbook this PDF was rendered from. Its file's date on disk says whether the
   *  snapshot is still current — named here rather than matched by label, because a wrong match
   *  would call a stale PDF fresh. */
  governs: string;
};
export const POLICY_PDFS: PolicyPdf[] = [
  { id: "doc-1789647350611", ref: "ANH-DOC-00800", label: "Policies index", policies: [], lang: "en", governs: "doc-hb-compiled-anahon-policies-index" },
  { id: "doc-1789647350601", ref: "ANH-DOC-00799", label: "Policies index", policies: [], lang: "ar", governs: "doc-hb-ar-compiled-anahon-policies-index" },
  { id: "doc-1789647350635", ref: "ANH-DOC-00802", label: "Team Handbook", policies: ["P1", "P2"], lang: "en", governs: "doc-hb-compiled-anahon-team-handbook" },
  { id: "doc-1789647350623", ref: "ANH-DOC-00801", label: "Team Handbook", policies: ["P1", "P2"], lang: "ar", governs: "doc-hb-ar-compiled-anahon-team-handbook" },
  { id: "doc-1789647350657", ref: "ANH-DOC-00804", label: "Editorial Standards Handbook", policies: ["P3", "P4"], lang: "en", governs: "doc-hb-compiled-anahon-editorial-standards-handbook" },
  { id: "doc-1789647350646", ref: "ANH-DOC-00803", label: "Editorial Standards Handbook", policies: ["P3", "P4"], lang: "ar", governs: "doc-hb-ar-compiled-anahon-editorial-standards-handbook" },
  { id: "doc-1789647350683", ref: "ANH-DOC-00806", label: "Finance and Controls Handbook", policies: ["P5", "P6", "P7"], lang: "en", governs: "doc-hb-compiled-anahon-finance-and-controls-handbook" },
  { id: "doc-1789647350670", ref: "ANH-DOC-00805", label: "Finance and Controls Handbook", policies: ["P5", "P6", "P7"], lang: "ar", governs: "doc-hb-ar-compiled-anahon-finance-and-controls-handbook" },
  { id: "doc-1789647350706", ref: "ANH-DOC-00808", label: "Programmes and Funding Handbook", policies: ["P8", "P9"], lang: "en", governs: "doc-hb-compiled-anahon-programmes-and-funding-handbook" },
  { id: "doc-1789647350695", ref: "ANH-DOC-00807", label: "Programmes and Funding Handbook", policies: ["P8", "P9"], lang: "ar", governs: "doc-hb-ar-compiled-anahon-programmes-and-funding-handbook" },
  { id: "doc-1789647350729", ref: "ANH-DOC-00810", label: "Strategic Plan", policies: ["P10"], lang: "en", governs: "doc-hb-compiled-anahon-strategy-007" },
  { id: "doc-1789647350718", ref: "ANH-DOC-00809", label: "Strategic Plan", policies: ["P10"], lang: "ar", governs: "doc-hb-ar-compiled-anahon-strategy-007" },
  { id: "doc-1789647350752", ref: "ANH-DOC-00812", label: "Information, Data and Source Privacy", policies: ["P11"], lang: "en", governs: "doc-hb-anahon-information-data-010" },
  { id: "doc-1789647350740", ref: "ANH-DOC-00811", label: "Information, Data and Source Privacy", policies: ["P11"], lang: "ar", governs: "doc-hb-ar-anahon-information-data-010" },
];

/** Both PDFs (English then Arabic) of the handbook a policy number sits in. */
export const policyPdfsFor = (no: string): PolicyPdf[] =>
  POLICY_PDFS.filter(p => p.policies.includes(no)).sort(a => (a.lang === "en" ? -1 : 1));

/** What may be sent out as a link: the papers and the policy pack. The zip is not here — the
 *  outbox carries PDFs only, and a browser cannot be handed a .zip by this machinery. */
export const SHAREABLE_IDS: ReadonlySet<string> = new Set(
  [...PAPERS.map(p => p.id), ...POLICY_PDFS.map(p => p.id)],
);
/** The papers alone — the ones whose bytes are closed to everyone else. */
export const PAPER_IDS: ReadonlySet<string> = new Set([...PAPERS.map(p => p.id), PAPERS_ZIP.id]);

/**
 * Who opens an official paper, and who sends one out: the Executive Director and the Finance
 * Officer, **as themselves**. Assuming the seat from another account does not open the statute —
 * the same rule a sealed source file follows (`maySealedRead`), for the same reason: these papers
 * identify the organisation, and a borrowed seat is not the person.
 */
export function mayOpenPapers(viewer: { role?: string; active?: boolean } | null | undefined, actingAs: string): boolean {
  if (!viewer || viewer.active === false || String(actingAs || "").trim()) return false;
  return viewer.role === "Super Admin" || viewer.role === "Finance Officer";
}
export const PAPERS_REFUSAL =
  "The organisation's official papers are opened by the Executive Director or the Finance Officer, as themselves.";

/** How long a link lives. A paper has no validity date of its own, so it gets one number. */
export const PAPER_LINK_DAYS = 7;
export function paperLinkExpiry(now: Date): Date {
  const day = new Date(now.getTime() + PAPER_LINK_DAYS * 86_400_000).toISOString().slice(0, 10);
  // End of the Beirut day, as a quotation link does — see quoteShare.shareExpiry.
  return new Date(`${day}T23:59:59+02:00`);
}

/** The name the recipient's browser saves it under. Built from the reference number, so a file
 *  sitting in someone's Downloads still says which paper of ours it is. */
export function paperLinkName(ref: string): string {
  // Dots collapse as well as the rest: the outbox file is named from the token, not from this,
  // but a name reading "AnaHon-..-..-etc-passwd.pdf" has no business in a URL we send out.
  const name = `AnaHon-${String(ref || "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/\.{2,}/g, "-").replace(/^[-.]+|[-.]+$/g, "")}.pdf`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(name)) throw new Error("Not a display name.");
  return name;
}
