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
/**
 * How much protection a link to this paper gets — Saad's decision, 18 Sep 2026, by class of paper.
 *
 * "none" is the statute: he attaches the file to an email himself. The certified true copy is the
 * one paper where "here is a link" is worse for us than "here is the file".
 * "once" is the registration and tax set — the papers that prove AnaHon is AnaHon, and the set
 * someone would want in order to impersonate it: opened once, then the file is gone, 24 hours.
 * "week" is everything else: premises, the website set, and the filed policy PDFs.
 */
export type LinkClass = "none" | "once" | "week";
export const LINK_DAYS: Record<Exclude<LinkClass, "none">, number> = { once: 1, week: 7 };

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
  link: LinkClass;
  /**
   * Another paper on this shelf that carries the same instrument. This one's card folds into that
   * one's, which names it in `foldNote` — either because this one's file is lost (00395), or
   * because the same paper is genuinely on file twice and the other copy is the fuller one
   * (00311, the Arabic-only announcement, against 00822, which carries the certified English).
   *
   * NOT the superseded mechanism, on purpose: that one means "an older edition, replaced by a
   * newer one of ours", and it works by moving the file into a /Superseded/ folder — impossible
   * here, since the file is what is missing. Calling a lost file superseded would turn a loss
   * into a tidy replacement in the one register where that must never happen.
   */
  heldAs?: string;
  /** The sentence the holding card shows. Written per pair, because "the original was lost" and
   *  "the same paper is also on file" are different facts and neither should be guessed from the
   *  other. */
  foldNote?: string;
};

export const PAPER_GROUPS = ["Registration & identity", "Premises", "Website registration", "Tax"] as const;
export type PaperGroup = (typeof PAPER_GROUPS)[number];

export const PAPERS: Paper[] = [
  // ---- Registration & identity ------------------------------------------------
  { id: "doc-court-cert-ar", ref: "ANH-DOC-00394", date: "2023-10-12", group: "Registration & identity", link: "once",
    title: "Court registration certificate 90/2023 (Arabic)",
    proves: "The court's own Arabic certificate that AnaHon is registered as civil company 90/2023." },
  { id: "doc-reg-cert-en", ref: "ANH-DOC-00310", date: "2023-10-12", group: "Registration & identity", link: "once",
    title: "Registration certificate 90/2023, certified English",
    proves: "The certified English certificate of the company's registration — the one to give a donor or a foreign bank." },
  { id: "doc-1789654293478", ref: "ANH-DOC-00821", date: "2023-10-12", group: "Registration & identity", link: "once",
    title: "Court registration certificate 90/2023 — Arabic and certified English",
    proves: "The bilingual certified copy — Arabic original and sworn English translation in one file." },
  { id: "doc-1789653353157", ref: "ANH-DOC-00817", date: "2023-10-12", group: "Registration & identity", link: "once",
    title: "Court registration request, civil partnership 90/2023 — Arabic and certified English",
    proves: "The application AnaHon filed to be registered, showing what was declared to the court." },
  { id: "doc-1789647217629-c047", ref: "ANH-DOC-00796", date: "2023-10-13", group: "Registration & identity", link: "once",
    title: "Civil company registration notice and certificate (Arabic, 2 pages)",
    proves: "The registration notice and certificate issued the day after the court entry." },
  { id: "doc-civil-license", ref: "ANH-DOC-00311", date: "2023-09-30", group: "Registration & identity", link: "once",
    heldAs: "ANH-DOC-00822",
    foldNote: "The same announcement is also on file as ANH-DOC-00311, Arabic only; this copy carries the certified English.",
    title: "Civil announcement 14712/2023 — the company's registration, made public (Arabic certified copy)",
    proves: "The official announcement that AnaHon was registered as a civil company taking the form of a general partnership — naming its office, its five purposes, and Saad Matar as manager and sole authorised signatory." },
  { id: "doc-1789654507974", ref: "ANH-DOC-00822", date: "2023-11-02", group: "Registration & identity", link: "once",
    title: "Civil announcement 14712/2023 — the company's registration, made public (Arabic and certified English)",
    proves: "The official announcement that AnaHon was registered as a civil company taking the form of a general partnership — naming its office, its five purposes, and Saad Matar as manager and sole authorised signatory. Proof the registration was published, not only filed." },
  { id: "doc-1789652359601", ref: "ANH-DOC-00814", date: "2023-09-30", group: "Registration & identity", link: "none",
    title: "Constitutive statute, certified true copy (Arabic, 11 pages)",
    proves: "The complete certified true copy of the founding statute — use this one." },
  { id: "doc-statute-ar", ref: "ANH-DOC-00395", date: "2023", group: "Registration & identity", link: "none", heldAs: "ANH-DOC-00814",
    foldNote: "The original scan (ANH-DOC-00395) was lost; this certified copy carries the same text.",     title: "Constitutive statute (Arabic, 11 pages)",
    proves: "The founding statute: what the company is, who manages it, how money is decided." },
  { id: "doc-1789647217623-7a9a", ref: "ANH-DOC-00794", date: "2023-11-02", group: "Registration & identity", link: "none",
    title: "Constitutive statute, certified true copy — page 1 only",
    proves: "The first page of the statute as a separate certified copy, for when only the front page is asked for." },
  { id: "doc-1789647217634-8145", ref: "ANH-DOC-00798", date: "2022-10-13", group: "Registration & identity", link: "none", // NOT classified by Saad — defaulted to no link until he places it
    title: "ANAHON S.A.R.L — articles of association, single partner (2022)",
    proves: "An earlier attempt with a lawyer to set up a separate limited company, notarised on 13 October 2022 and cancelled before registration. AnaHon was registered instead as a civil company in 2023." },
  { id: "doc-reg-cert-ar", ref: "ANH-DOC-00309", date: "2023-10-30", group: "Registration & identity", link: "once",
    title: "Ministry of Finance registration certificate 3893185 (Arabic)",
    proves: "The Ministry of Finance certificate carrying AnaHon's tax number, 3893185." },
  { id: "doc-1789653177476", ref: "ANH-DOC-00816", date: "2023-10-30", group: "Registration & identity", link: "once",
    title: "Ministry of Finance certificate 3893185 — Arabic and certified English",
    proves: "The bilingual certified copy of the tax-number certificate." },

  // ---- Premises ---------------------------------------------------------------
  { id: "doc-1789652819324", ref: "ANH-DOC-00815", date: "2025-07-15", group: "Premises", link: "week",
    title: "Office lease, Tal 730/11 — Arabic original and certified translation",
    proves: "The lease on the Tal office, USD 6,000 a year. Signed in Saad's personal name, not the company's, and it ran out on 14 July 2026 — no renewal is on file." },
  { id: "doc-1789653708168", ref: "ANH-DOC-00818", date: "2023-09-30", group: "Premises", link: "week",
    title: "Permission to occupy the office, notary 6083/2023",
    proves: "Kariman Ahmad Kaddour's irrevocable declaration letting AnaHon occupy the premises free of charge and for no fixed period, and use them as its registered address — the paper the registration relied on." },
  { id: "doc-1789653708218", ref: "ANH-DOC-00819", date: "2005-05-10", group: "Premises", link: "week",
    title: "Land registry certificate, property 554/E/11 Basatin Tripoli",
    proves: "The land registry's certificate that Kariman Ahmad Kaddour owns that division outright, which is what stands behind her permission for AnaHon to sit there." },

  // ---- Website registration ---------------------------------------------------
  { id: "doc-1789647217629-5234", ref: "ANH-DOC-00797", date: "2022-06-13", group: "Website registration", link: "week",
    title: "Website registration form (إستمارة علم وخبر)",
    proves: "The form filed to register anahon.org as a publication." },
  { id: "doc-1789647217627-160c", ref: "ANH-DOC-00795", date: "2022-08-05", group: "Website registration", link: "week",
    title: "Website registration statement (افادة علم وخبر)",
    proves: "The statement issued on that filing." },
  { id: "doc-1789654115613", ref: "ANH-DOC-00820", date: "2022-08-05", group: "Website registration", link: "week",
    title: "Website notice certificate NAC 97, anahon.org — Arabic and certified English",
    proves: "The certificate, number NAC 97, that anahon.org is a registered publication — the paper a press body asks for." },

  // ---- Tax --------------------------------------------------------------------
  { id: "doc-a-general-tax-regularization-2023-income-tax-declaration-filed-receipts-24", ref: "ANH-DOC-00371", date: "2024-07-18", group: "Tax", link: "once",
    title: "2023 income tax declaration, as filed (receipts 245019055, LibanPost)",
    proves: "The 2023 income tax return as filed, with the LibanPost receipt proving the date it was lodged." },
  { id: "doc-a-general-tax-regularization-jad-maaliki-paid-audit-invoice-pdf", ref: "ANH-DOC-00372", date: "", group: "Tax", link: "once",
    title: "Auditor's invoice, paid (Jad Maaliki)", proves: "" },
  { id: "doc-regpack-2026", ref: "ANH-DOC-00383", date: "2026-07-31", group: "Tax", link: "once",
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
 * The reading behind the papers — the statute transcription, the facts report, the alignment work,
 * the letters to the lawyer and the accountant. Working documents, not papers the company issues on
 * demand, so they are NOT in PAPERS and never appear as cards in its groups.
 *
 * Gated by CATEGORY rather than by a list of ids, and deliberately so: the rule then exists before
 * the rows do, so a document is covered the instant it is filed. Gating by id would mean filing
 * first and gating second, and in that gap anyone on the documents seat could open them — document
 * URLs are guessable, which is why the check lives in docOnDisk in the first place.
 *
 * They need the same gate as the papers: they state that FY2024 and FY2025 are unfiled, that the
 * only proof of the 2023 filing is lost, and that the supervision-delegate seat conflicts with a
 * paid role. None of that belongs on the documents seat. They are never sent as links either —
 * SHAREABLE_IDS is a list of ids and these are not on it.
 */
export const READING_CATEGORY = "Official_Papers_Reading";

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

/* ---- The outbox a paper link is written into --------------------------------------------
 *
 * Its OWN directory and its OWN address, never the quotation outbox on icontent.studio. Two
 * reasons, both Admin's (18 Sep 2026). Client-facing iContent material never names AnaHon, and
 * "icontent.studio/…/AnaHon-ANH-DOC-00814.pdf" puts an AnaHon legal document on the client-facing
 * iContent domain — the inverse of the rule already written into QUOTATION-LINKS.md. And the
 * sensitivity is not the same: a leaked quotation is embarrassing, while the statute, registration,
 * MoF certificate and lease are the set someone would want in order to impersonate AnaHon to a bank
 * or a ministry, and an unguessable token is the only control on this route.
 *
 * So both settings are required and neither has a default. **With either unset no link can be
 * issued at all** — the shelf says so and the button is not drawn. That is deliberate: until Saad
 * settles the host, and whether a public-token link is acceptable for statutory papers in the first
 * place, the unsafe thing is impossible rather than merely unused.
 */
export const paperOutboxDir = () => process.env.PAPER_OUTBOX || "";
export const paperShareOrigin = () => process.env.PAPER_SHARE_ORIGIN || "";
export const PAPER_LINKS_UNSET =
  "Links for official papers are not set up on this server yet — they need their own AnaHon address, not the quotation one.";

/** The address a recipient is sent. `/p/`, never the quotation route's `/q/`, so one token
 *  namespace can never be asked to serve two brands. */
export function paperShareUrl(token: string, ref: string): string {
  if (!/^[0-9a-f]{32}$/.test(token)) throw new Error("Not a share token.");
  const origin = paperShareOrigin();
  if (!origin) throw new Error(PAPER_LINKS_UNSET);
  return `${origin.replace(/\/+$/, "")}/p/${token}/${paperLinkName(ref)}`;
}

/** The filed policy PDFs travel with everything else: a week. */
export const POLICY_LINK_CLASS: LinkClass = "week";

/**
 * When a link dies. A week runs to the end of its Beirut day, as a quotation link does; a
 * one-time link is 24 hours from the moment it was made, because rounding it to the end of a day
 * would sometimes hand out nearly two.
 */
export function paperLinkExpiry(now: Date, cls: Exclude<LinkClass, "none">): Date {
  if (cls === "once") return new Date(now.getTime() + 86_400_000);
  const day = new Date(now.getTime() + LINK_DAYS.week * 86_400_000).toISOString().slice(0, 10);
  return new Date(`${day}T23:59:59+02:00`);
}

/**
 * Whether the serving side can actually take a one-time link down after its first fetch.
 *
 * The FMS writes a file into an outbox and something else mirrors and serves it; **nothing tells
 * the FMS the file was fetched**, so this side cannot make a link one-time on its own. Admin sets
 * `PAPER_LINK_ONCE=1` only once their side removes the file on first successful download.
 *
 * Until then a "once" paper gets **no link at all** rather than a plain 24-hour one. Saad approved
 * one-time for the registration and tax set; handing him a reusable link instead — one that keeps
 * working every time it is forwarded — would be quietly giving him something weaker than what he
 * agreed to, which is worse than making him wait.
 */
export const linkOnceEnforced = () => process.env.PAPER_LINK_ONCE === "1";

/** Why this paper cannot be sent as a link right now, or "" if it can. */
export function linkBlocker(cls: LinkClass): string {
  if (cls === "none") return "This paper is not sent as a link — attach the file to the email yourself.";
  if (cls === "once" && !linkOnceEnforced())
    return "A one-time link for this paper is not switched on yet: the server that hands it out cannot yet remove it after the first download, and a link that keeps working is not what was agreed.";
  return "";
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

/* ---- Writing and removing the file ------------------------------------------------------
 *
 * Both take a token, and the token is the whole filename. Neither ever lists the directory, so
 * this side cannot delete a file it did not write — Admin's standing rule for a shared outbox,
 * where a "tidy up what I don't recognise" pass would take a client's live quotation with it.
 */
export const paperOutboxName = (token: string) => {
  if (!/^[0-9a-f]{32}$/.test(token)) throw new Error("Not a share token.");
  return `${token}.pdf`;
};

/** Write it under a dot-name and rename, so a syncer never mirrors half a PDF. The mtime IS the
 *  expiry, set before the file becomes visible. */
export function writePaperPdf(fsMod: typeof import("node:fs"), dir: string, token: string, pdf: Buffer, expiresAt: Date): void {
  if (!dir) throw new Error(PAPER_LINKS_UNSET);
  const name = paperOutboxName(token);
  const part = `${dir}/.${name}.part`;
  fsMod.writeFileSync(part, pdf, { mode: 0o640 });
  fsMod.utimesSync(part, expiresAt, expiresAt);
  fsMod.renameSync(part, `${dir}/${name}`);
}

export function deletePaperPdf(fsMod: typeof import("node:fs"), dir: string, token: string): void {
  if (!dir) return;
  fsMod.rmSync(`${dir}/${paperOutboxName(token)}`, { force: true });
}
