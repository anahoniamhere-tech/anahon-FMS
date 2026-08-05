# AnaHon FMS — session handoff (30 July 2026)

Paste this file's path into a new chat and say: **"Read HANDOFF.md and continue."**

---

## 1. Where everything lives

| Thing | Path / location |
|---|---|
| **The app** | `/Users/saadmatar/antigravity/AnaHon-Financial-Management-System` |
| **Database** | `prisma/dev.db` — **SQLite, local file only.** Untracked by git (deliberately). This IS the system of record. |
| **Document vault** | `~/Downloads/AnaHon_Document_Vault` — **THE single AnaHon folder** (2.8GB): 383 registered documents + `ARCHIVE/` holding byte-verified copies of the old `ANAHON/` archive, the SKF working folder and `Receipts_Employees/` (originals in `~/Downloads` safe to delete since 31-Jul-2026). **Local only, no backup.** App finds it here; override with `ANAHON_VAULT`. |
| **Policy brain** | `/Users/saadmatar/Obsidian/AMS/AMS` — Obsidian vault, 18 notes built strictly from the Accounting Policies Manual v020. Keep it manual-derived only; no project/donor content. |
| **Run the app** | `npm run dev` → http://localhost:3000 (Vite + Express + Prisma). Login is Firebase; `anahoniamhere@gmail.com` is **Super Admin** (temporary, see task below). |
| **Repo** | github.com/anahoniamhere-tech/anahon-FMS — work is on branch `feat/reports-ai-scan-bank-import`, **not yet merged to main**. |

Bank statements (source of truth for cash): `/Users/saadmatar/Documents/eBLOM_Stmt_004-02-…_1-7…csv` (USD) and `…004-04-…_1-5…csv` (EUR).

---

## 2. What the system currently holds

129 expense vouchers · 226 bank transactions · **298 documents** · 4 employees · 34 timesheets · 11 vendors · 48 audit entries · **10 donors · 8 projects**.

**Two projects reconciled to the bank** (the other six are backfilled records — see §3a):
- **TRF-2026** "Truth in Motion" — Active, $10,020 budget, 100% burn, 52 vouchers. Ended 30 Jun 2026, closeout in progress.
- **FPU-2025** "Voices Unseen" — Completed and **fully settled** (EUR 20,313 received + 2,236 final on 02-Jul-2026), 77 vouchers.

**Bank (BLOM Business Plus, one account, two currency sub-accounts):**
- USD `004-02-353-2343794-1-7` → closing **$1,402.80**
- EUR `004-04-353-2343794-1-5` → closing **€2,421.58**
- Both tie exactly to their statements (movements = closing balance).

**12-month donor income: $70,447.05** from six sources — SKF (MediaMig €20,297.30 + services $1,651.38), FPU (€23,070), Asfari ($10,000), WeWorld ($4,301.50), TRF ($5,029.43).

---

## 3. Immediate next steps

### 3a. ~~Vault reconciliation~~ — **DONE 30 Jul 2026**

Backfill script: `prisma/backfill-legacy.ts` (`npx tsx prisma/backfill-legacy.ts`). Idempotent — deterministic ids, upserts, safe to re-run. DB backed up to `prisma/dev.db.bak-20260730-174321` first.

**8 donors created** — Samir Kassir Foundation, The Asfari Foundation, Basmeh & Zeitooneh, WeWorld GVC, IRI, Front Line Defenders, FHI 360, Tripoli Entrepreneurs Club. Each carries its bank evidence in `notes`.

**6 projects created.** Project `code` deliberately equals the vault folder name, so document pointers resolve with **no files moved**:

| Code | Status | Budget | Basis |
|---|---|---|---|
| `ASFARI-2026-LER` | **Active** | $10,000.00 | received 09-Jun-2026 |
| `SKF-2026-MEDIAMIG` | **Active** | $23,151.10 | €20,297.30 first payment @ 1.1406 |
| `ASFARI-2024` | Completed | $8,877.68 | received 21-Jun-2024 |
| `SKF-2025-INVJ` | Completed | $3,295.12 | $1,643.74 + $1,651.38 service payments |
| `BWZ-2023-FRL` | Completed | $0.00 | no deposit in statement period |
| `FPU-2024-ICONTENT2` | Completed | $0.00 | no deposit — funded via BOB Finance |

**14 vault files registered** against the four historical projects. Verified: 298 AppDoc pointers, **0 broken links**; new documents return HTTP 200 through `/api/document/content/:id`.

**Budget basis = cash actually received** (user decision). The vault budget spreadsheets were rejected as sources: `ASFARI-2024/Budget/Budget - Asfari.xlsx` is internally titled *"SKF Budget … 1 Apr 2022 till 31 June 2022"* and is a near-duplicate of `SKF-2025-INVJ/Budget/Budget - SKF - SharaKa.xlsx`. They are recycled templates, not those grants.

**Still needs the user's real figures — these are placeholders, do not report them to donors:**

1. ~~`SKF-2026-MEDIAMIG` budget is the first payment only~~ **RESOLVED 31 Jul from the signed Acte de Rétrocession SKF-AH-09/2026 (Drive):** total sub-grant **€50,895** ($58,050.84 @ 1.1406), AFD money via SKF; period May-2026 → Apr-2029 (fund-use limit 01-Sep-2029, annual reports each 15 Jun). 5 budget lines registered from Annexe 3 (Megaphone: Journalistes 9k / Production 18k / Post-prod 13.5k / Diffusion 4.5k + **Frais administratifs €5,895 = 14% admin allowance covering rent/utilities/admin**). Payment mechanics: €20,350 at signature (received €20,297.30 net 02-Jun); next instalments only after 75% liquidation of the previous; final 10% on completion; >10% reallocation needs SKF notification. **User still to drop the signed docx into the vault** (`SKF-2026-MEDIAMIG/Agreement/`).
2. `ASFARI-2024` end date `2024-12-31` is invented (start 21-Jun-2024 is real).
3. `FPU-2024-ICONTENT2` dates are year-only placeholders (`2024-01-01`→`2024-12-31`). Proposal budget was €19,980 over 4 months.
4. `SKF-2025-INVJ` dates are year-only placeholders.
5. `BWZ-2023-FRL` shows $0 but its own financial report states a **$19,932 grant with $4,072 spent** — confirm which is right.
6. ~~`ASFARI-2026-LER` ends `2026-08-15`~~ **RESOLVED 30 Jul from the Grant Offer (Google Drive):** commencement 29-Apr-2026 (signature), grant period to **30-Apr-2027**, final report **31-May-2027**. 5 budget lines ($5,000) registered from the approved Year Plan — food/hygiene distributions + fuel, activity window 10-Jun→01-Aug-2026. The other $5,000 is deliberately unallocated (not in the approved plan — open with Asfari). **Pending: user must drag `AnaHon_Media_Asfari_Grant_Offer.docx` → vault `ASFARI-2026-LER/Agreement/` and `Planning_and_Reporting_..._Year_Plan_Filled.xlsm` → `ASFARI-2026-LER/Budget/` from Drive (binary transfer via tooling corrupted; originals must come from the source), then register them in the app.**

**Deliberately not done:** the 13 superseded originals and ~21 working artifacts stay unregistered (correct per §13.3). No duplicates deleted — §13.7 needs FO + PD approval. The 6 minor income streams (IRI, FLD, WeWorld, FHI360, TEC) are **donors only, no projects** — no documents exist to define a project shape.

### 3a-bis. Projects are now referenced to their bank accounts — **DONE 30 Jul 2026**

Standing rule from the user: **a project must always name the bank account that funded it, and every figure must show its source.**

- Migration `20260730180000_bank_transaction_project` adds nullable `BankTransaction.projectId`. Outgoing money already reached a project through `voucherNo → Expense.projectId`; incoming donor money had no such path, so it now carries the project directly.
- **12 deposits linked** (matched on exact date + amount — a non-unique match is reported and left unlinked, never guessed):

| Project | Received | Account |
|---|---|---|
| `TRF-2026` | $5,029.43 | USD `004-02-…-1-7` |
| `FPU-2025` | €23,070.00 | EUR `004-04-…-1-5` |
| `ASFARI-2024` | $8,877.68 | USD |
| `SKF-2025-INVJ` | $3,295.12 | USD |
| `ASFARI-2026-LER` | $10,000.00 | USD |
| `SKF-2026-MEDIAMIG` | €20,297.30 | EUR |

- **13 deposits deliberately unlinked:** WeWorld $4,301.50, IRI $4,000, FLD €1,370, FHI360 pass-through, TEC $1,355 (donor records only), plus FX conversions, reversals and the opening cash deposit (operational, not donor income).
- **UI (`src/App.tsx`):** the project workspace header shows `🏦 Funded into: <account> <accountNo> <amount> — source: BLOM statement, N receipts`, or an amber **"funding source unverified"** when nothing is linked. Folder 4 now lists money in (green, `+`) and money out (red, `−`), each with its source account number.
- **New `formatIn(val, currency)` helper** — bank money renders in the currency it actually moved in. `formatUSD` was printing EUR receipts as dollars, which misstates the source document.
- `PORT` in `server.ts` now reads `process.env.PORT` (default 3000) so a second instance can run alongside.

⚠️ **Migration-history landmine:** `prisma/migrations/` is *behind* the live DB — `userEmail`, `netAmount` and `allocationsJson` exist in `dev.db` but not in the `init` migration (added by an earlier `db push`). A naive `prisma migrate diff --from-migrations` therefore emits a table rebuild that **drops those columns**. Always diff `--from-schema-datasource` (the live DB) instead, or reconcile the history first.

### 3a-ter. Payroll payment source + document automation — **DONE 30 Jul 2026**

**Payroll now names a real account.** The employee form offered *"Bank Audi Wire" / "Petty Cash USD" / "USD Cash Check"* — **AnaHon banks with BLOM, not Bank Audi.** That string was the default in `App.tsx`, `server.ts` and `prisma/seed.ts`, so it kept coming back.

- Migration `20260730190000_employee_bank_account` adds `Employee.bankAccountId`.
- The form now has two fields: **Funds Drawn From** (options generated from the real `bankAccounts`, so it cannot drift again) and **Delivered By** (bank transfer / cash withdrawal).
- **Cash payroll still requires an account** — per the user: cash is withdrawn from the bank first. The server rejects a missing or unknown account on both paths.
- All 4 employees backfilled to BLOM USD; Assem Nayrab is now "cash withdrawn from BLOM USD", not cash from nowhere. ⚠️ USD was assumed because salaries and allowances are USD figures — **correct any employee actually paid from the EUR account.**
- `prisma/seed.ts` fixed too, so a reseed cannot reintroduce the wrong bank.

**Documents: `docgen.ts` (new).** Renders, files into the vault, registers as an `AppDoc`.

- **Invoices auto-digitize.** `syncDigitizedInvoice` runs on voucher create, on every approve/pay action, and on direct petty cash. Idempotent — one record per voucher, overwritten in place (verified: firing twice does not create a second). Failures are logged and never block an approval or payment.
- **Contracts generate from data.** `POST /api/contracts/generate` + a per-employee form in Payroll. Employment or Service, with period, LoE, monthly fee and total. **Every figure is typed by a human** — nothing is inferred from salary, because a contract is a signed instrument. Output is unsigned and states it.
- **Countersignatory comes from the `User` table**, never hardcoded. It currently resolves to Marwan El Cheikh (Finance Officer) because no active Program Director exists — Saad is still temporary Super Admin. It will pick Saad up automatically once §4.2 roles are restored (31 Aug task). Contrast with the still-open bug in §5.6.

⚠️ **Bug found and fixed on the way:** `project.code` is not the vault folder name — `TRF-2026` lives in `TRF-2025-IMS`, `FPU-2025` in `FPU-2025-SUBGRANT`. The **pre-existing** `/api/document/upload` endpoint used the code, so every future upload for those two projects would have been scattered into a new empty folder away from the audit file. `vaultFolderForProject()` now resolves it from where the project's existing documents actually live (data-driven, no hardcoded map) and both upload and docgen use it.

**Accessibility — partially done, be honest about the rest.** Generated documents are accessible by construction: `lang`, real `<title>`, one `<h1>`, `<caption>`, `<th scope>` throughout. In the app: page title fixed (was still *"My Google AI Studio App"*), toasts now announce via `role="status"`/`alert` + `aria-live`, and the payroll and contract forms have properly associated labels.
**Still open: 66 of 80 `<label>`s in `App.tsx` are not associated with their control** (`htmlFor`/`id`), and there is essentially no `aria-label` coverage on icon-only buttons. That is a mechanical but large sweep across a 5,900-line file and was deliberately not done blind. It is the main remaining WCAG gap.

**Not done, needs a decision:** the 129 legacy vouchers still carry their original `Digitized Invoice` records generated from the donor-submitted financial report. New live records (`Digitized`) are only created when a voucher is next touched. Backfilling all 129 would give every old voucher a second record — say so if you want that, otherwise the two categories coexist by design.

### 3a-quater. Bank-proof-only projects — **DONE 30 Jul 2026 (user rule)**

**Standing rule: a project exists for the app only with bank proof** — at least one statement deposit carrying its `projectId`. Enforced by `fundedOnly()` in `server.ts`, applied at **all four** places projects are served: `/api/state`, `/api/reports/period` (donor-facing), the AI invoice scanner's prefill targets, and the compliance-audit context.

- **Hidden now: `BWZ-2023-FRL` and `FPU-2024-ICONTENT2`** (no deposit in the statement period). They remain in the database with their 6 + 3 registered documents intact — relink a deposit and they reappear; nothing was deleted.
- **Creation requires proof:** `/api/projects/new` now takes `fundingTxId` and rejects a missing reference, a withdrawal, or an already-claimed deposit; on success it links the deposit to the new project and audit-logs the full evidence (date, amount, account). The new-project form has a "Funding Deposit (Bank Proof)" picker listing only unclaimed statement deposits.
- Treasury Pool card now prints its source: `source: BLOM statements as of <last tx date> · EUR at <rate>`. The figure ties to imported statements, not the bank's realtime balance — statement import IS the sync (verified: $1,402.80 + €2,421.58×1.1406 = $4,164.85 exactly; live differs only by post-27-Jul activity, ~$34.80).

⚠️ Consequence to remember: since deposits prove projects, importing the next statement period is now also how new projects become registrable.

### 3a-quinquies. eBLOM advice import (pending transactions) — **DONE 30 Jul 2026**

**Why it exists:** BLOM has no usable API for Lebanese accounts (developer portal domain is dead; the PSD2 API is BLOM *France*; Lebanon has no open-banking rules; aggregators don't cover it). BLOM also sends **no transaction emails** — Gmail holds only eBLOM auth codes. The only realtime artifact is the transaction-advice PDF downloadable from the eBLOM portal.

**Pipeline:** Banking tab → "Import eBLOM advice PDF" → `POST /api/bank/import-notice` extracts text (PyMuPDF via `python3`, local dependency), parses **deterministically** (regex, no AI — bank figures are never guessed), and stages lines as `pending=true` / `noticeRef=<advice ref>` on `BankTransaction` (migration `20260730200000_bank_pending_notice`).

**Pending lines are quarantined everywhere:** excluded from banking-tab balance math, period reports, `fundedOnly()` project proof, the funding-deposit picker, and `/api/projects/new` (rejects a pending deposit as proof explicitly). Account balances are never touched. Treasury card shows them as a separate amber "⏳ pending advices" line, never added in.

**Dedupe/confirmation rules:** same `noticeRef` → skip; account+amount+type match on a statement line within ±3 days → skip (or, for older pending rows, auto-delete once a statement line covers them — statement wins). Unknown account or currency mismatch → skipped with reason, never guessed.

**Verified:** real advice PDF (APPLE.COM/BILL $23.80, ref 1260727) parsed correctly and was skipped as already-on-statement; synthetic advice staged, re-import deduped by reference, report/funding/balances unaffected while pending existed; test line then removed.

### 3a-sexies. Full lifecycle drill — **PASSED 30 Jul 2026** (one bug found and fixed)

ASFARI-2026-LER is fully onboarded: bank proof ($10,000 deposit) · Grant Offer + Schedule-4 proposal and Year Plan registered (originals from Drive, verified byte-identical) · 5 budget lines ($5,000) · corrected dates. A clearly-marked drill then ran the whole chain against a DB snapshot and was rolled back:

contract → procurement → voucher submit → finance-review → approve → cashbook-pay → general-ledger-post → auto-digitized record → report. **Every stage worked**; side-effects verified at each step (2 JEs, bank tx, balance −100, budget-line actual +100, digitized HTML served, report reflected the spend). Post-rollback state verified byte-clean (129 vouchers, $1,402.80, 357 JEs, 302 docs, 0 drill traces).

**Bug the drill caught (now fixed):** `cashbook-pay` defaulted `paymentMethod` to `"Petty Cash Box"`, so `general-ledger-post` credited 1120 petty cash while the money actually left the BLOM bank account — a ledger/bank mismatch on every default-path payment. Fix: the default now follows the disbursing account's type, and gl-post derives the credit account (1120/1110/1100) from the actual bank transaction, with the string only as legacy fallback. Re-drilled: payment JE credits 1100, method "Bank Transfer". ✓

Remaining honest gap for LER: the June–July distributions (food/hygiene) presumably happened but **no supplier invoices are in the system** — real vouchers need the real receipts.

### 3a-septies. Contract vs purchase — functions split (30 Jul 2026)

Three distinct paths, no longer conflated:

| Need | Where | Instrument |
|---|---|---|
| **Employee** on payroll/timesheets | Payroll tab → employee card → *📄 Employment contract* | Employment contract |
| **Service provider** (external, invoices us) | Vendors tab → *📄 Service agreement* in the new Engagement column | Service agreement |
| **Purchase** (goods, subscriptions, taxi) | Expenses tab → voucher | **None** — a contract is not required |

`POST /api/contracts/generate` now takes `employeeId` **or** `vendorId` (never both), and a vendor can only ever hold a Service agreement. Service-agreement wording differs from employment: fees payable **against the provider's invoice on delivery**, not against a timesheet; WHT noted; vendor tax ID and payee bank details carried onto the document. Non-engagement vendors are refused with an explanatory error pointing at the voucher route.

⚠️ **Bug the test caught — a data/vocabulary mismatch, now fixed.** The AI vendor scanner's category list had **no option for software subscriptions**, so Apple and OpenAI were auto-registered as *"Service Provider"* — the nearest match. Once category gated contract issuance, that mislabel would have allowed a **service agreement to be drafted with Apple**. Fixed both ends: the scanner vocabulary now includes Software Subscriptions / Transportation / Telecommunications with an explicit instruction that "Service Provider" means someone we *engage*, not someone we *buy from*; and the two miscategorised vendors were corrected (audit-logged).

Verified: Apple, OpenAI, Higgsfield, VIP Taxi, Jawhar Cell all **refused**; Maysaa Riz, Omar, Bilal Leila all **issue correctly**; missing party, both parties, blocked and inactive vendors all rejected. Test agreements removed afterwards (invented figures).

~~Residual risk: engageability is inferred from the free-text `category`.~~ **CLOSED 31 Jul 2026** — `Vendor.engageable` is now an explicit boolean (migration `20260731090000_vendor_engageable`) and is the sole gate; the category regex is gone.

- **Defaults to `false`** — a new vendor is a supplier until someone deliberately says otherwise.
- Set at registration via a checkbox, or later via `POST /api/vendors/engageable`, which **requires a written reason** when turning it on and audit-logs every change.
- Backfilled `true` for Maysaa Riz, Omar, Bilal Leila, Assem Nairab; `false` for all seven suppliers.
- Vendor-registration category list aligned with the AI scanner vocabulary (Software Subscriptions / Transportation / Telecommunications added).

**Regression test that matters:** Apple was relabelled back to category `"Service Provider"` with the flag left `false` — the exact shape of the original bug — and the agreement was **still refused**. The flag wins over the category. Toggle guardrails verified too: no-reason rejected, on→issue→off→refuse all correct, new vendors default to supplier. All test artifacts removed (302 docs, 11 vendors, unchanged).

### 3a-octies. Daily spending — real lodger wired in (31 Jul 2026)

**Found:** the "Daily Expenses Sheet" tab was dead code (`{false && …}`) and its submit handler was a placeholder that toasted "posted" while saving **nothing**. The fully-built `/api/expense/direct-petty-cash` endpoint had no UI caller. The cash-book date was hardcoded to `2026-05-25`.

**Now:** Banking tab → **⚡ Lodge Daily Direct Expense** — what/vendor/project/budget-line/amount, one submit posts the whole chain (voucher `Posted` + bank withdrawal + balance + budget burn + journal entry + digitized record). Amount is in the paying account's own currency. Cash book defaults to today.

**Three endpoint defects the test caught, all fixed:**
1. **WHT was withheld on counter purchases** — a $25 taxi ride recorded as $23.13 paid + $1.88 owed to MoF. Withholding now applies only to `engageable` vendors without a tax ID (services), never suppliers. Verified: taxi $25 → full $25 out, no WHT; Maysaa Riz $100 → $92.50 + $7.50 to 2315.
2. **WHT posted to 2310** (payroll tax) — now 2315, same reclass as the rest of the system.
3. **All ledger/bank dates were UTC** — an evening entry filed under yesterday (Beirut = UTC+3). New `localDate()` helper used at all 8 sites.

### 3a-nonies. Party files — per-person document view (31 Jul 2026)

**Problem:** documents were only reachable via projects/vouchers — no way to see one person's agreement + invoices together. (Trigger: "why isn't Omar's $900 added?" — it was, all of it, but invisible per-person.)

**Now:** *📂 open file* on every vendor row (Vendors tab) and employee card (Payroll tab) → panel with three sections:
1. **Agreements (generated)** — exact match via docId carrying the party id.
2. **Scanned contracts & timesheets (matched by name)** — legacy vault docs are linked to projects, not people, so these match by first name in the filename and are labelled as heuristic.
3. **Payments** — every voucher naming them as payee, with amount/status/project and its attached invoice + digitized record links.

Verified: Omar → contract + 3 vouchers $900 + 6 docs; Maysaa → contract + 4 vouchers $800 + 8 docs; Sally → 12 docs (contract + timesheets); Assem → employment contract, service agreement docs and timesheet.

**Hardened same day (user: "once and for all"):** `AppDoc.partyId` added (migration `20260731120000`) and **78 person-documents explicitly linked** by curated mapping — contracts, addenda, signed timesheets, FPU monthly receipts — full list in the `aud-partyid-migration` audit entry. The party file now reads the hard link; the name heuristic survives only as an amber "⚠ unlinked documents matching this name" safety net, which currently matches **zero** documents. Newly generated contracts are stamped with `partyId` at creation. **Mohamad Kabbara registered** as an engageable Service Provider (`ven-kabbara`) — his signed FPU service agreement was in the vault with no party record. Org-level documents (grant agreements, rental contract, FPU policy attachments, Roaa Awada receipt) deliberately left unlinked.

**Design note, deliberate:** Omar and Maysaa are NOT in payroll/timesheets and should not be — they are contractors paid per deliverable through vouchers (vendor identity), not salaried staff on timesheets. The party file makes that trail visible instead of pretending they are payroll.

### 3a-decies. DISCOVERED 31 Jul: SKF-AH-06/2025 Investigative Report grant — $26,000, mostly settled OFF-BANK (open)

Found in Drive (user prompt): a **$26,000 SKF grant** (15 Jun–31 Aug 2025, "Wathiqat al-Ittisal" investigation) absent from the app. Real budget + expense list ($24,008.88 spent; payees incl. Khaled W. Al Sabbagh $6,000, Saad Matar $3,000, **Mohammad Kabbara $3,000**, **Maysaa Riz $500**, Kaiber $1,429, Adobe $659.88, ElevenLabs $220), invoices 00165/2025 ($15,600 = 60%) and 00173/2025 ($6,500 = 25%).

**Two hard facts extracted:** (1) the invoices carry **MoF no. 3893185** — AnaHon IS MoF-registered; the regularization gap is unfiled declarations only (org identity + compliance task updated). (2) **None of the $26k hit BLOM** except, probably, the 13-Nov-2025 $1,651.38 "Kaiber & Adobe subscriptions contribution" (≈ Kaiber 1,429 + ElevenLabs 220) — currently mis-attributed to the website-mentorship engagement.

**RESOLVED & BOOKED 31 Jul (evidence: Gmail + user confirmation — settled BY CHEQUE):** three Byblos Bank cheques totalling **$26,000** ($15,600 + $6,500 + final $3,900 cheque no. 432821), cashed off-BLOM — recorded on evidence account `ba-skf-cheques` (Petty-Cash-type, inactive, zero balance; the rebuild maps such accounts to 1120, so the BLOM statement-tie invariant holds). Cheques 1–2 dates approximate (mid-Jul-2025, disclosed); cheque 3 evidenced. **15 vouchers ($24,008.88) booked** from the donor-submitted detailed list — payees include Saad Matar (new dual-identity vendor `ven-saad`), Khaled W. Al Sabbagh, Kabbara $3,000, Maysaa $500; $1,991.12 of grant cash remains undocumented. Project restructured to the real grant (budget $26,000, 15 Jun–31 Aug 2025, 5 real lines, 92% burn). The Jan ($1,643.74 website mentorship) and Nov ($1,651.38 — SKF finance: *"this is a different project covering the subscriptions"*) BLOM transfers un-conflated → SKF service income (4200) via new rebuild keyword. **FY2025 restated: income $42,166.79** (was 16.2k). **RESTATED AGAIN same day from the FINAL donor workbook** (user downloaded the full Drive folder): **24 invoice-numbered vouchers, $23,987.50** supersede the July interim list. Material corrections: translator = **Sabah Kayyal** (new party `ven-sabah`), *not* Maysaa — her erroneous 5th payment removed; AI tools charged **pro-rata** (Kaiber 300 / ElevenLabs 45.83 / Adobe 137.50) and the remainders reconcile **exactly** to the Nov SKF subscriptions reimbursement (1,129 + 522.38 = 1,651.38); Ahmad Ayshan has a provider identity (`ven-ahmad`, workshop coordinator 2×$200); suppliers registered (Kaynoona, Leila's Production, KeyTech, Liwaa). **Vault import complete: 44 documents** — signed grant agreement, final budget workbook, both outgoing invoices, financial + narrative + long-form reports, 8 service agreements, 8 signed receipts and 17 supplier invoices **each linked to its exact voucher** (all 24 vouchers carry their evidence; zero unattached). Civil Company license filed under `GENERAL/Legal`. Undocumented cheque-cash residual: $2,012.50; petty gap $47,423.32. **Evidence pack still stale — regenerate before the accountant.**

### 3a-undecies. FPU IContent2 booked · BWZ trail found (31 Jul)

**FPU-2024-ICONTENT2 fully booked & now VISIBLE** from the FPU-approved final report (EB 13052024, Drive): budget €19,980, actual **€19,160 (96%)**, settled **off-bank via BOB Finance** — 6 tranches, $16,723.90, transfer refs recorded on evidence account `ba-fpu-bob`. 16 budget lines + line-summary vouchers @ realized 1.04735 (the itemised ~190-line register stays in the Drive workbook; **FY2023/24 expense split needs it — flagged**). Era personnel noted: Jaylan Kahlawi, Wissal Kantar.

**Three findings:** (1) **FY2023 was NOT nil** — $10,505 received Dec-2023 (+ some Dec spending); the evidence pack's nil-2023 claim is superseded. (2) **FPU owes €3,193** (€4,013 final instalment − €820 underspend) with no receipt evidence anywhere — receivable to pursue/verify with FPU. (3) Per-year now: FY2023 +10,505 / FY2024 income 20,659 / FY2025 42,167 / FY2026 55,924. **Evidence pack is 3 restatements stale — must regenerate.**

**BWZ-2023-FRL — trail found, booking blocked on payment evidence:** Gmail holds the 2023 correspondence (payment requests incl. "second payment request" 05-Jun-2023, no-cost extension to ~Sep-2023, final narrative report); Drive `BwZ_FRL/Project Papers/` holds `Finance/`, `payment request/`, `مستندات دفع/`, `trainer invoice/`, `Employees Contract/` folders. **Amounts actually received unknown** — user to download the BwZ_FRL finance folders (like the SKF folder) or state the amounts; then book on a `ba-bwz` evidence account and un-hide.

### 3a-duodecies. ANAHON archive mined (31 Jul) — **FY2023 WAS FILED** · BWZ booked · all 8 projects visible

Searched the 2.14GB `~/Downloads/ANAHON/` archive + `Receipts_Employees/`. Curated 32 documents into the vault (383 total). Headlines:

1. **FY2023 tax declarations WERE filed** — the "Audit Report-combined.pdf" is the 2023 declaration pack **with filing receipts**: MoF e-receipt **245019055** (Saad's personal F1, 04-07-2024, **0 LL due**, partner-share annex 49أ ref 3893185) + **LibanPost Tripoli receipt 18-07-2024** for the company partnership declaration (LBP 630,000 fees, stamped). Prepared by accountant **Jad Maaliki** (his PAID invoice is on file). **Regularization scope narrows to FY2024 + FY2025 (+2026 running).** Compliance task reframed; calendar events still carry the old wording — update on next touch.
2. **BWZ un-hidden and booked**: budget $19,932 (15-Apr→15-Sep-2023 incl. extension); payment 1 **evidenced** ($5,000, BOB TN 988-493-5787, 03-05-2023). **Payments 2–3 ($5,000 each) BOOKED PROVISIONALLY** at their request dates per user instruction — counted, flagged, reversible; compliance task `ct-bwz-confirm` tracks confirmation; final ~$4,932 NOT booked (no request evidence). **Month-1 expenses vouchered** from the donor-submitted TL: 18 vouchers, $4,072.10 — including the 2023 team salaries (Assem $200/m, Marwan $140/m, Jaylan $80/m, Maryam $40/m, Ahmad $40/m) + Saad trainer $400, confirming the user's point that BWZ cash was the team's payment source. New era vendors: BitarNet, Samer el Haj (2023 landlord), Kabbara Electricity (supplier — distinct from Mohamad Kabbara); Marwan added as inactive era employee. Months 2–5 expenses (~$10.9k) still undocumented — petty gap reflects it. FY2023: income $25,505 / expenses $4,072.
7. **Custom-timeframe reports (user request):** `/api/reports/period` + `/pdf` now accept any `months=1..60` or an explicit `start=YYYY-MM`; Reports tab has a "Period starting (optional)" picker — set it and the button becomes "Generate <start> → <end> Report". PDF filenames adapt (`N-MONTH-FINANCIAL-REPORT`). Verified: Apr–Dec 2023 (BWZ window), Jun–Aug 2025 (SKF grant window), 3-month, 12-month.
3. **14 signed TRF cash receipts** filed to party files (Saad/Ahmad/Sally monthly, Assem, Omar per-payment) — the TRF cash trail now has signatures.
4. **Real Asfari-2024 agreement** (`Anahon Media_PE Grant Agreement (2024)_FINAL.pdf`) + real budget filed — the recycled-template mystery closed.
5. **Archive leads — resolved by user rule (31-Jul): only bank/evidence-backed entity money gets booked.** **LEB-CAAP/Spotlight: DROPPED** — personal-capacity work by team members related to Saad directly, not entity income; documents stay in ARCHIVE for reference only. **Malek Allouch retained** (`ven-malek`) because the FHI360 pass-through naming him IS on the BLOM statements ($915 + $579.19, 2024, booked as liability owed onward). SDA (2024) and the 2022 pre-registration era remain archive-only, not pursued. FPU-2026 supplier receipts (Energica, Ibrahim Cams, Kaynona €800) still worth attaching to Voices Unseen vouchers when convenient.
6. **Evidence pack now stale again** (FY2023-filed + BWZ) — regenerate via `prisma/evidence-pack.py` after updating its FY2023/never-filed wording.

### 3a-terdecies. Five-program structure + funding funnel — **DONE 31 Jul 2026**

**Org model (user, 31 Jul):** AnaHon the company is the head — sole applicant, implementer, financial body. Five programs under it: **AnaHon Platform** (SKF territory: MediaMig, INVJ, + TRF-2026), **iContent Academy** (FPU-2024-ICONTENT2, FPU-2025 Voices Unseen, BWZ-2023-FRL — it's literally named "I Am the Content"), **Ahali Al Madina** (humanitarian/dev, Asfari LER 2026 only; name verified from the Asfari Grant Offer — "community-led initiative … active since 2024"; ASFARI-2024 was **Core / Org-wide** per user correction 31 Jul), **Roots & Reach** (community × influencers, TED-style events — zero funded projects yet), **Production** (earned income; SKF services live here conceptually — no projects). Plus a **Core / Org-wide** bucket for backbone funding (SKF FSTP).

- Migration `20260731220000_project_stream_opportunity`: `Project.stream` + new `Opportunity` table (funding funnel: Prospect → Drafting → Submitted → Awarded / Declined). **Quarantined by design** — separate table, never joined into reports/balances; an award becomes a Project only through the existing bank-proof creation flow. DB backed up to `dev.db.bak-20260731-222325-pre-streams`.
- All 8 projects stream-assigned (audit entry `log-streams-backfill`). 5 pipeline opportunities seeded: SKF FSTP €12k Submitted (decision 15 Aug), FPU/Asfari/TRF renewal prospects, Roots & Reach first-funder placeholder.
- Server: `/api/opportunities/save` (upsert, stage+donor validated, audit-logged), `/api/opportunities/delete`; `opportunities` in `/api/state`; `/api/projects/new` accepts `stream`.
- UI: **Programs & Funnel tab** — six stream cards (funded projects, totals, pipeline count, amber gap warning when no active project + no pipeline) + pipeline board with add/edit/move/delete. Stream select on new-project form; stream badge on project cards. Verified end-to-end in browser (CRUD, stage moves, toasts, audit trail); test artifacts removed.
- BWZ placement (iContent Academy) and TRF placement (Platform) are **my defaults from project names — user has not confirmed these two.**

### 3a-quattuordecies. Production stream: clients & quotations — **DONE 31 Jul 2026**

- Migration `20260731230000_client_quotation`: `Client` (pays US — distinct from Donor/Vendor) + `Quotation` (Draft → Sent → Accepted/Rejected/Expired → Invoiced; quote numbers `QT-<year>-NNN`, **max-based** numbering so deletions can't collide with the unique index). Backup `dev.db.bak-…-pre-clients`. Quotations are forward-looking like Opportunities — never income; income books only from statement lines (4200).
- Endpoints: `/api/clients/save`, `/api/quotations/save`, `/api/quotations/delete` — validated + audit-logged; `clients`/`quotations` in `/api/state`.
- UI: **Production & Clients tab** — client log cards (with per-client quote count + accepted total) and quotations table with status flow. Funnel tab's Production card shows open-quote count.
- Seeded `cli-skf` (Samir Kassir Foundation) from its evidenced service income ($1,643.74 + $1,651.38 on BLOM, invoices 00165/00173-2025).

### 3a-quindecies. Quotation builder from the real Drive template — **DONE 1 Aug 2026**

Drive holds AnaHon's real quoting practice (`Quotation_Template.xlsx` + filled quotes to Akkarouna, Semeurs D'avenir, War Child, Kaya, UJLEB…). Distilled into the app:

- Migration `20260731234500_quotation_items`: `Quotation.itemsJson` + `termsJson`. With line items the total is **computed, never typed**.
- **Numbering matches the paper trail**: `NNN/YYYY` (auto, max-based) with manual override on create — Drive quotes reach **021/2026**, so the first app quote should be typed as `022/2026`; auto-numbering continues from max thereafter.
- Form: line-item rows with a **23-entry service catalog dropdown** (real list prices: event coverage $300/day, podcast $480, videographer $250/day…) prefilling description/output/price, all editable; standard-notes section (financial terms dropdown — 3 real OMT variants, production/technical note checkboxes, extras) defaults ON for new quotes.
- `/api/quotations/generate-doc` + 📄 button: renders the client-facing document in the real ANAHON Production layout (header, MOF 3893185, Output column, note blocks), files to vault `GENERAL/Quotations/`, registers as AppDoc (idempotent per quote). `docgen.ts` STYLE now forces light color-scheme + white background (dark-mode browsers were rendering all generated docs near-invisible).
- Verified end-to-end: items→total $1,200, manual/auto/duplicate numbering, doc render screenshot-checked against the template, vault filing; all test artifacts removed (0 quotations, 383 docs).

### 3a-sexdecies. Quotation bank settlement — **DONE 1 Aug 2026**

- Migration `20260801010000_quotation_payment`: `Quotation.paymentTxId` + status **"Paid"**. Client work now closes its loop with bank evidence, mirroring project funding: quote → Accepted → deliver → Invoiced → statement deposit linked → **Paid**.
- `/api/quotations/link-payment`: only real non-pending statement deposits count; one deposit settles one quote; unlink reverts Paid → Invoiced (no evidence = no "Paid"). Audit-logged with full deposit details.
- UI: amber **payment-match suggestions** panel (unclaimed, non-project deposits matching an open quote's currency + amount ±1% — human confirms, never auto-linked), Payment column with 🏦 settled date + unlink. Verified end-to-end in browser against the IRI $4,000 deposit; test quotes removed.
- **Client work does NOT auto-become a project** (user question, answered by design): quotations are the tracking unit for production jobs; income books from statement lines as 4200. Big contracts can still be promoted manually via project creation ("Unrestricted Service", stream Production) using the client deposit as bank proof.

### 3a-septdecies. Unique document references + master-only numbering — **DONE 1 Aug 2026**

- Migration `20260801020000_appdoc_refno`: `AppDoc.refNo` (unique, `ANH-DOC-NNNNN`). **All 383 existing documents backfilled** in registration order (audit `log-docref-backfill`). Auto-assigned at every registration (docgen `archive()` preserves a doc's ref across regenerations; upload endpoint assigns on create); the ref is **printed on every generated document's footer**.
- `/api/documents/set-ref`: amending a reference is **Super Admin (master) only**, uniqueness-enforced, audit-logged. UI: ref chip next to each document in the project Folder Explorer — click-to-amend for master, read-only otherwise. (Enforcement is client-supplied-role level, same as the rest — §5.3.)
- **Quotation numbers now fully automatic** (`NNN/YYYY`, max-based); manual numbering rejected with 403 unless master account. First real quote: master types `022/2026` once to continue the Drive paper sequence, then auto continues.
- Verified: non-admin quoteNo/set-ref rejected, dup ref rejected, regeneration keeps ANH-DOC-00384, ref printed on doc, chips render in workspace. Test artifacts removed (383 docs, 0 quotations).

### 3a-octodecies. Off-bank quotation settlement (OMT / BOB / Whish / cash) — **DONE 1 Aug 2026**

Client payments mostly arrive off-BLOM (user: OMT, BOB Finance, Whish, or cash). Wired per the house evidence-account pattern:

- New evidence account **`ba-prod-offbank`** ("Client payments off-BLOM", Petty-Cash-type, inactive, zero balance — same shape as ba-skf-cheques / ba-fpu-bob). `rebuild-ledger.ts` rule added: deposits on it credit **4200 service income** (deterministic by account id). Rebuild re-run after testing: **balanced, both bank ties exact**.
- `/api/quotations/settle-offbank`: method ∈ {OMT, BOB Finance, Whish, Cash}, **evidence reference mandatory** (transfer ref, or signed receipt № for cash) — no ref, no booking. Creates the deposit line, links it as the quote's `paymentTxId`, status → Paid, audit-logged. Unlink **deletes the evidence line with it** (else rebuild would book income with nothing behind it) and reverts Paid → Invoiced.
- UI: 💵 button on unpaid quotation rows → inline form (method / reference / date / amount). Bank-transfer settlements unchanged (statement import → amber match panel → confirm).
- **User's first real quote exists: 001/2026 "Event" USD 1,280 (SKF), doc ANH-DOC-00384.** Note: auto-numbering started at 001/2026 while the Drive paper trail reached 021/2026 — if continuity matters, master should renumber (delete + recreate with manual № 022/2026) before it's sent.

### 3a-novodecies. Project Officer role + first real §5.3 hardening — **DONE 1 Aug 2026**

**Assem Nayrab (u-8) is now Project Officer, scoped to the FPU projects** (proj-fpu-vu, proj-fpu-icontent2). Requester → approver → payer chain now has its first enforced separation:

- Migration `20260801120000_user_project_officer`: `User.projectIdsJson`.
- **Server middleware (the real change): whenever a POST names a user id, the role is resolved FROM THE DATABASE and the client's claimed role is discarded.** Deactivated accounts refused. A set of money/control endpoints now rejects anonymous (no-user) calls outright. Remaining §5.3 gap: a caller can still send someone else's id — full fix = Firebase token verification (31 Aug §4.2 scope).
- Project Officer = requester-only, enforced server-side: POST allowlist {auth/sync, expense/new, procurement/new, document/upload, expense/scan-invoice}; expense/procurement creation restricted to assigned projects; everything else 403.
- **§4.3 segregation of duties enforced for everyone**: the requester of a voucher (Expense.requestorId) cannot finance-review or approve it — server refuses regardless of role.
- `/api/users/set-role` (master only, lockout-guarded, audit-logged) + **Team & Roles panel** in the Compliance tab (role select per user; project checkboxes for Project Officers). UI: Project Officers get a 4-tab nav (Overview / My Projects / Purchase Requests / Procurement) and project dropdowns limited to their scope.
- Verified end-to-end: role spoof (u-8 claiming Super Admin) neutralized; PO blocked from approve/pay/master endpoints; out-of-scope project rejected; in-scope voucher created (requestorId stamped); FO self-review refused by §4.3 while another officer could act; anonymous money-call refused; deactivated user refused. Test vouchers removed, budget-line commitments reversed to zero.
- ⚠️ Bug I introduced and fixed during this work: raw-SQL audit entries used `datetime('now')` (no ISO "T"), crashing the Compliance tab's audit-log clock rendering. All timestamps normalized to ISO; renderer hardened. **Rule for future sessions: AuditLog.timestamp must be ISO-8601 — don't insert `datetime('now')` via sqlite.**

### 3a-vigesies. MADA project + Project Officer UX fixes — **DONE 1 Aug 2026**

- **MADA-2026 created** ("MADA — Content Creators Program", iContent Academy stream, donor IRI, $4,000, Restricted Grant). **Bank proof: the unclaimed IRI deposit 24-Oct-2024 $4,000 (`ba-blom-usd-0052`)** — the only $4,000 in imported statements; ⚠️ user said "we have a 4,000 transfer in the bank" — **if MADA's money is actually a newer transfer not yet imported, unlink this and relink after the next statement import.** Dates 2026-08-01→2027-08-01 are placeholders. **Budget: single placeholder line MADA-01 ($4,000, Direct Project Activities) — replace with the approved IRI breakdown before any donor-facing report.**
- Assem's Project Officer scope now: FPU-2025, FPU-2024-ICONTENT2, **MADA-2026** (verified: he can raise vouchers on MADA, Policy 2.4 enforced, requestorId stamped).
- PO UX fixes from Assem's first login: payroll nav hidden for POs; voucher + procurement forms now include "Project Officer" in the UI role gate (server allowed it, UI hid the form); dashboard KPI cards (treasury/approvals/VAT) hidden for POs; dashboard burn list, projects tab cards scoped to assigned projects; donor profiles hidden for POs.
- Assem connects from his laptop on the same WiFi: `http://192.168.1.21:3000` (IP may change with the router; Saad's Mac must be awake with the server running).

### 3a-unvicesies. Proposal workspace on the funnel — **DONE 1 Aug 2026**

- Migration `20260801140000_opportunity_proposal`: `Opportunity.proposalJson`. Every pipeline opportunity now carries a **proposal workspace** (📝 on its card): 7 sections in AnaHon's master order (summary / problem / solution / objectives / deliverables / outputs / outcomes) + activities-timeline rows + indicative budget rows. **Budget rows drive the opportunity's requested amount on save** (never typed twice).
- `/api/opportunities/proposal-doc` + "Save + Generate Document": renders the **AnaHon master proposal** (applicant identity block: Civil Company 90/2023, MOF 3893185; overview table; sections; timeline & budget tables) → vault `GENERAL/Proposals/`, registered AppDoc with unique ref. Explicitly labeled "internal master — adapt to the donor's template"; donors' own formats stay the submission vehicle.
- Verified end-to-end on the FSTP opportunity (test content reverted, test doc removed).

### 3a-duovicesies. AI proposal assist ("the brain") — **DONE 1 Aug 2026**

- `/api/opportunities/ai-assist` (Gemini, same key as the scanners): **grounded in AnaHon's real identity + per-stream track record assembled from the DB** (`anahonBrainContext()`), never free-floating. Two modes on the proposal workspace: **🔍 Assess Fit** (fit Strong/Moderate/Weak, recommended stream, rationale, risks, pitch angle) and **✍️ Draft Empty Sections** (fills only sections the user left empty; unknowns come back as `[FILL: …]`; nothing saved without the user). Audit-logged.
- Live-verified: a sample creators-training call was assessed Strong / iContent Academy, citing the real FPU projects and flagging a genuine deadline discrepancy + team-capacity risk.
- **Working agreement (user):** for real calls, the user brings the link/documents to Claude in chat for the deep assessment (full FMS+Drive+Gmail context); in-app Gemini assist is the always-available fallback.
- **Call intake — three ways in (1 Aug):** `POST /api/opportunities/call-source` accepts a **PDF** (PyMuPDF, the same local path as the bank-advice importer), a **.docx** (python zipfile on `word/document.xml`, no new dependency), plain text, **or a link** (fetched, tags stripped, 20s timeout, 40k-char cap). Extracted text lands **in the editable box for the user to read and correct before any AI runs** — extraction never submits. `.doc` and scans are refused with a clear message. **SSRF guard:** localhost / 10.x / 192.168.x / 172.16-31.x / 169.254.x / ::1 refused. **Prompt hardened:** call text is labelled untrusted DATA with an explicit instruction to ignore any instructions embedded in it.
- **The pipeline is the user's decision:** the proposal workspace has a **Pipeline / programme** selector saved with the proposal; when the AI recommends a different stream it appears only as a one-click suggestion ("AI suggests X — use it"), it never moves the card itself.
- **Master budget: DOES NOT EXIST yet** (user asked). Only per-project donor budgets. 12-month documented actuals (Aug 25–Jul 26): expenses $38,509 / 131 vouchers (Office 8.5k, Personnel+HR 11.7k, Contractors 4.5k, Other 9k…), income $74,347 — the seed data for an annual OrgBudget module (predicted vs actual vs funded-by, core-gap figure for core-fund asks). Offered, not yet wired.

### 3a-trevicesies. EED file reconstructed from Gmail — **1 Aug 2026**

- **History:** applied Oct 2024 (ref 900991073535, Pia Kfoury / Maya, met in Brussels Nov 2024). Feb 2025 assessment questions **answered**. 22 May 2025 call → Pia's 23 May email set 3 requirements: **amended 12/18-month budget, Annex D (outcomes/outputs of the EED grant, sized to budget), Annex 1 Financial Sustainability + Annex 2 Audience Metrics**. **Never sent** → formally rejected 25 Nov 2025; Pia 10 Dec: rejected for silence, **door open** — "catch up in the new year… clearer and more structured on your end". No contact Jan–Jul 2026.
- Templates in Drive: Dec-2025 working copies (folder `1qcg0HWUR…`) — Annex 1 **still empty**, Annex 2 **partial baselines** (YouTube/FB/IG/TikTok, some values look off — e.g. "Followers 1/+0.2%", "-283.5"), Annex D untouched.
- **Done 1 Aug:** EED added to pipeline (`opp-1785595632932`) · Gmail draft to Pia written then **PARKED — user decision: do NOT send yet.** Sequence first: (1) MoF regularization FY2024-25 (Jad Maaliki) + CNSS, (2) **strategic plan for Platform + iContent Academy** (EED = media priority; the ask comes out of the plan), (3) then re-engage — rewritten around the plan. **Deadline guard: if filings are moving by end-Sep, email goes out in October regardless** — silence killed round 1. Draft r7973368562518931658 stays in Drafts as raw material.

### 3a-quattuorvicesies. LER Activity 6 + Omar Al-Abyad engagement — **1 Aug 2026**

- **Two LER distribution evidences surfaced (photos with user, NOT yet lodged):** cooperative receipt 18-Jul-2026 — الجمعية التعاونية الاستهلاكية في الشمال received **$1,150 from Omar Al-Abyad** for 46 × $25 food coupons for Ahali Al Madina; supplier invoice Sinv006642 20-Jul-2026 (نبيل مخلص الجمل, Tripoli) food parcels **$1,123.98** billed to "أهالي المدينة". → **User to lodge both via the AI invoice scanner** against A1/A2 (photos attach as evidence). Open Q per voucher: who actually paid (Omar reimbursement vs direct)? Note: evidence names Ahali Al Madina, not AnaHon — coherent with the Grant Offer (named community initiative), keep the linkage documented.
- **Line A6 registered ($2,500, Contractors/Freelancers)** from the FILLED Year Plan Activity 6 (field logistics/volunteer coordination 1,500 + PM/finance/reporting 700 + banking/consumables 300). ⚠ Activities 6–7 are in the *filled* plan — **confirm Asfari approved the revised plan before donor reporting** (old flag: "the other $5,000 not in approved plan").
- Vendor ven-3 renamed **Omar Al-Abyad** (full name from the receipt). **Service agreement generated: ASFARI-2026-LER-SA-OA-2026-06 (ANH-DOC-00388)**, $2,500 total, 10-Jun-2026 → 30-Apr-2027, vault `ASFARI-2026-LER/Contracts/` — unsigned output, print & sign. Payment via voucher(s) on A6; Omar has no tax ID → **7.5% WHT** ($187.50 to 2315, net $2,312.50) unless he provides one.

### 3a-quinvicesies. LER/Nada correspondence audit — **1 Aug 2026**

- **Finding (checked BOTH mailboxes — anahoniamhere via connector, smmatarr via Chrome): the filled Year Plan was NEVER emailed to Nada.** Her 2-Jun condition: plan reviewed → approved → then implementation. Implementation ran anyway (distributions July). Her 1-Jun platform-onboarding question was also never answered by Asfari.
- **Reply draft ready in Gmail Drafts (r5063093391235289583)**, replying to Nada's 15-Jul LER follow-up: progress narrative (46 coupons via cooperative, food parcels from Tripoli supplier, distributions to shelters/households, FMS tracking) + "for good order, attached the filled Year Plan (Activities 1–7), we would welcome your confirmation" — quietly closes the approval gap. **User must DRAG THE FILE IN before sending:** `~/Downloads/AnaHon_Document_Vault/ASFARI-2026-LER/Budget/Asfari_LER_Year_Plan_Filled.xlsm` (connector attachment skipped — 34KB b64 not worth the context).
- Omar Al-Abyad's email: omaralabiad21@gmail.com (from Apr-2026 forward).

### 3a-sexvicesies. LER distributions booked — **1 Aug 2026**

- **PV-2026-132 $1,150** (46 food coupons, Consumer Cooperative North `ven-coop-north`, receipt 18-Jul) → line **A1**; **PV-2026-133 $1,123.98** (food parcels, Nabil Mokhles El Jamal `ven-nabil-jamal`, invoice Sinv006642 20-Jul) → line **A2**. Both suppliers registered `engageable=false` → **no WHT** (goods, not services).
- **Booking rule applied (important precedent): paid from petty cash ALREADY drawn at BLOM** (ATM 15 & 27 Jul are on the statement and already Dr 1120), so the vouchers are `paymentMethod=Cash` with **NO new BankTransaction** — the rebuild credits 1120 once via the voucher cash leg. Creating a bank line too would double-count the outflow.
- Rebuild re-run: **balanced (Dr=Cr 330,471.53), both bank ties exact**, petty cash **55,008.26 → 52,734.28** (−2,273.98 — documented spend shrinking the real gap). LER burn now **$2,273.98 / 10,000 (23%)**.
- ⚠️ **Evidence photos not attached** — user has them on phone; upload via the new 📎 Attach invoice control (below).

### 3a-septentricies. Donor activity timetable + core project documents — **2 Aug 2026**

User supplied `~/Downloads/_Activity timetable Anahon.xlsx` — the real donor Gantt AnaHon submits — and the principle: *"once we write the proposal, we submit the timetable and the budget; those documents should always be available in a project."*

- **Timetable import** (`POST /api/activities/import-timetable`, 📊 button in the workspace): parses the donor .xlsx with openpyxl — Result headings, hierarchical outline numbers (regex handles `1.3.Select` with no space), **bilingual EN/AR titles**, and **which period columns each activity is shaded in** (multi-period spans preserved). Migration `20260802060000_activity_timetable` added `outlineNo, resultGroup, titleAr, startDate, periodsJson`; `source="imported"`. Re-importing **replaces only the imported rows** — manual and auto steps survive.
- Rendered as a **Gantt grid** above the milestone list: activities grouped by Result, numbered, Arabic subtitle RTL, shaded cells per period (green when Done), status dropdown per row.
- **Verified on the real file:** 12 activities, 7 periods, spans intact (2.2 Filming across 4 periods, 3.1 Publishing across 3). **Imported into MADA-2026 — user confirmed that is the right project.**
- **📑 Core Project Documents panel** (per project) — the four papers a project must always carry: **Proposal · Activity timetable · Approved budget · Signed agreement**. Each slot shows the filed document (clickable) or **"missing"** in amber, with an upload that files straight into the right category. The all-projects overview now also prints `missing: proposal, timetable, budget` per row.
- **What it exposed org-wide — only FPU-2025 is complete.** No project except FPU-2025 has a timetable on file; only FPU-2025 and SKF-2025-INVJ have a proposal; **MADA-2026 had nothing at all** (now 3 of 4 missing, timetable satisfied by the import).
- ⚠️ **Unresolved on MADA (user: "leave it now, we will fix it later"): the dates conflict.** The timetable runs **20 Jun → 31 Jul 2026** (so the project would already be finished) while the project record says **1 Aug 2026 → 1 Aug 2027** — placeholder dates I invented at creation. Every auto milestone is built off the placeholder dates and is therefore wrong. Also still unconfirmed: donor recorded as IRI from the Oct-2024 $4,000 deposit, and no signed agreement on file.

### 3a-sextricies. Programme-scoped access — Assem sees iContent only — **2 Aug 2026**

User: *"Assem only has access for the programme iContent — he sees the budget of only iContent and the records of only this project, and nothing else."* Two gaps existed: his scope was a hand-picked project list (new iContent projects wouldn't be included), and the **vouchers/procurement lists were still serving him every project's records**.

- Migration `20260802050000_user_stream_scope`: **`User.streamScope`** — a Project Officer is scoped to a whole **programme**, plus any individually named projects. `scopedProjectIds()` is now the single source of truth and replaced four ad-hoc `projectIdsJson` checks (expense/new, procurement/new, waiver-inline, activities/save).
- **`/api/state?uid=` filters server-side, so other programmes' figures never leave the machine.** A Project Officer receives: only their projects, budget lines, vouchers, procurements, timeline steps and documents; and **empty** bank transactions, journal entries, employees, timesheets, assets, partner accounts, cash counts, subscriptions, clients, quotations, opportunities, compliance tasks, audit log and chart of accounts. Client sends `uid` (stored at auth-sync, cleared on sign-out) and re-fetches when it changes.
- **Assem set to programme "iContent Academy".** Verified side by side — Saad: 9 projects / 192 vouchers / 238 bank lines / 8 employees / 390 docs. **Assem: 4 projects (all iContent) / 111 vouchers / 35 budget lines / 0 bank lines / 0 employees / 0 subscriptions / 155 docs.** Writes verified too: he can now act on **BWZ-2023-FRL** (auto-included by the programme — note this is the completed 2023 "I Am the Content" project; remove it from his reach by naming projects individually instead of a programme if that's unwanted) and is still refused on ASFARI-LER.
- Team & Roles now has a **Programme** selector per Project Officer ("every project in that programme, now and later") beside the individual project checkboxes.
- ⚠️ Enforcement still rests on the client-supplied `uid`/`user.id` (§5.3). A determined caller could send another id; **Firebase token verification remains the real fix** (31 Aug §4.2).

### 3a-quintricies. Project timeline & assignments — **2 Aug 2026**

Migration `20260802040000_project_activity` + `ProjectActivity` (projectId, title, detail, kind Activity/Milestone/Report/Payment, dueDate, assigneeUserId, status Planned/In Progress/Done/Cancelled, budgetLineId, source manual|auto, completedOn). **Project workspace → 🗓 Project Timeline & Assignments.**

- **Alerts:** red = overdue ("Nd overdue"), amber = due within 14 days, green strike-through when Done. Steps sort by due date and show the assignee.
- **Standard 8-step template, evidence-driven (rebuilt 2 Aug on user request — "make the system own template… and by reverse, if the document was available mark the activities done"):** every project gets **agreement · funds received · budget registered · implementation starts · mid-point review · activities end · final report · closeout**. Each is **auto-marked Done when the evidence already exists** — a registered agreement/contract doc, a linked deposit, budget lines, booked vouchers, ≥50% burn, a past end date, a report document, status Completed — and the row records *why* ("Auto-completed: 2 deposit(s) totalling 5029.43 linked to this project").
- **Safety:** deterministic ids (`act-auto-<project>-<key>`), never overwrites an existing row, and evidence **only upgrades Planned → Done** — a human's In Progress / Cancelled / Done is never touched. Re-running is a no-op.
- **`{all: true}` builds every project at once** (respecting Project Officer scope). Verified: **9 projects → 72 steps created, 52 auto-marked done from existing evidence**; immediate re-run created 0. **Donors & Projects → 🗓 Project Timelines** lists every project sorted by overdue, showing done/total and the next step; clicking a row opens that workspace.
- Live picture: FPU-2025 and SKF-2025-INVJ fully closed (8/8); TRF-2026 7/8 with only "Grant closed out" open — exactly right, it awaits the final tranche; ASFARI-2024 has **3 overdue**, FPU-2024-ICONTENT2 **2**, BWZ and MADA **1** each.
- ⚠️ The report step's date is still a computed placeholder (end + 1 month) — correct each donor's real deadline by hand (LER's is 31-May-2027).
- **Assignment:** any active user; audit log records who it went to.
- **Project Officer scoping verified:** `/api/activities/save` + `/generate` added to their allowlist (delete deliberately **not**), and the endpoint refuses a project outside their scope — Assem blocked on LER, allowed on FPU-2025.
- **Live data now on ASFARI-2026-LER:** the 4 auto milestones (⚠️ note "implementation starts 2026-04-29" shows **95d overdue** — the grant's recorded startDate is the signature date, so consider marking it Done) plus a real step: **"Hygiene kits — 110 families in 6 shelters (A3) + 50 households (A4)", due 20-Aug-2026, assigned to Assem Nayrab** — the $950 that is still unspent.

### 3a-quattuortricies. Subscription renewal tracker — **2 Aug 2026**

Migration `20260802020000_subscription` + `Subscription` model (name, vendorId, matchText, amount, currency, cycle Monthly/Quarterly/Annual, nextRenewal, bankAccountId, project/budget line, status, notes). **Vendor Registry → 🔁 Subscriptions & Renewals.**

- **Alerts by renewal date:** red row = overdue ("Nd overdue"), amber = due within 7 days, otherwise "in Nd". Header shows active count, **monthly equivalent and annualised** total (Annual ÷12, Quarterly ÷3).
- **✓ paid** rolls the renewal forward by one cycle — month-end safe (31 Jan + 1 month → 28/29 Feb, never 3 Mar). Status Active/Paused/Cancelled inline; all changes audit-logged.
- **🔍 Find in statements** (`GET /api/subscriptions/detect`) groups withdrawals by merchant, ignores bank's own charges (ATM/maintenance/stamp duty/commission/FX), needs 2+ charges, infers the cycle from the median gap, flags **"amount varies"**, and skips anything already tracked. Suggestion only — one click prefills the form, nothing is created automatically.
- **Live detection on real statements found 5:** APPLE COM (11 charges, ~$14.78, varies — likely several Apple subscriptions billed separately), HIGGSFIELD (9, ~$50.47, varies — credit purchases rather than a fixed plan), GOOGLE (3, ~$25.79), NOKNOK SAL (2, ~$44.79), SIMLY (2, $4, stale 2024). **Not yet tracked — user to review and add.** Note also Anthropic ($20 → now Max $200/mo), FastComet $21.99, Photoroom $4.99 seen in the ledger.
- Verified: overdue/due-soon/future colouring, monthly-equivalent maths ($15 + $20 + $240/12 = $55), roll-forward 2026-07-28 → 2026-08-28. Test rows removed (0 subscriptions).

### 3a-tertricies. Donor replies sent + duplicate records retired — **1 Aug 2026**

- **Asfari/Nada: SENT 1-Aug 19:59 UTC (cc Ammar) WITH `Asfari_LER_Year_Plan_Filled.xlsm` attached** — verified in Gmail. **This closes the biggest open compliance gap on LER:** the Year Plan Nada asked to review on 2-Jun had never been delivered, yet implementation ran. Activities 6–7 (including Omar's $2,500 engagement) are now formally before the donor. `cr-asfari-ler-balance` retitled to await her confirmation/edits.
- **TRF/Luisa: reply CONFIRMED sent 29-Jul-2026** from anahoniamhere (cc Light Juma). My earlier "not found" was a **search artefact — the thread listing truncates messages**; don't trust a thread's message list as complete, fetch the thread when it matters.
  - Luisa queried 4 transactions on 22-Jul; the flagged lines map to vouchers **R023 / R026 / R029 / R031**. Reply explained that personnel are paid per signed contract at a **fixed monthly fee, 20% LoE** (Program Director $312/mo, Graphic Designer $240/mo), February pro-rata for the 10-Feb start and **June as a balancing payment closing each contract at its approved value**; the original timesheets valued months as days×day-rate (attendance, not the billing basis), which is why they didn't tie to the invoices.
  - **FMS corroborates this exactly:** A.1.1 = 211.71+312+312+312+**412.33** = **1,560.04** (approved 1,560.00); A.1.3 = 162.86+240+240+240+**317.14** = **1,200.00** (approved 1,200.00). The high June vouchers are the balancing payments, as described.
  - Deliverables sent: column-O line-by-line answers, memo **ANH-TRF-CLAR-001**, reissued timesheets **SaT4 / SaT5 / SaT6 Rev.2 / ST6 Rev.2** (signed; attendance records unchanged and on file), via view-only OneDrive.
  - **Status: awaiting Luisa's confirmation since 29-Jul. The USD 4,990.57 is NOT automatic — AnaHon must ISSUE the final invoice once she confirms.** `cr-trf-final` retitled accordingly. ⚠️ Minor: A.1.1 is **$0.04** over approved and the project overall **$8.99** over ($10,028.99 vs $10,020.00) — immaterial, but have the answer ready if TRF's spreadsheet flags it.
- ⚠️ **Stale duplicate draft to delete:** an older Nada draft `r7081139070565812305` (29-Jul) is still in Drafts alongside the one that was actually sent. The EED draft `r7973368562518931658` is parked deliberately — do not send.
- **Duplicate digitized records retired:** only 2 vouchers (PV-TRF-001, PV-TRF-003) carried both a legacy `Digitized Invoice` and a current `Digitized` record. Removed ANH-DOC-00127 and ANH-DOC-00130 (registrations only — **vault files untouched**); each voucher now shows its real source invoice + one current record. **The other 127 legacy records were deliberately left alone** — they are the only digitized record those vouchers have, and regenerating them would recreate the duplication. 390 docs, 0 vouchers with both.

### 3a-duotricies. Mobile + phone access — **1 Aug 2026**

- **Mobile fixes:** conventional **☰ menu button** in the phone header (the desktop edge-handle is now `hidden md:flex`), plus a **ع / EN** language toggle on mobile. **RTL bugs fixed:** the sidebar was pinned `left-0` with a `-translate-x-full` slide, so in Arabic it sat on the wrong edge and slid the wrong way — now `right-0` + `translate-x-full` when `lang==="ar"`, and the desktop handle mirrors to the right edge with the arrow direction flipped. Sidebar also scrolls (`overflow-y-auto`) for short screens.
- Verified at 375×812: menu starts closed, opens over a dim backdrop, closes on nav tap; the voucher form stacks to one readable column in Arabic; desktop unchanged.
- **Wide tables on phones (2nd pass):** 11 tables had no scroll container. Fixed with **one CSS rule** in `index.css` (`@media (max-width:767px) { main table { display:block; overflow-x:auto } … }`) rather than 11 JSX edits — figures scroll inside their own table and are never squashed, and `html,body{overflow-x:hidden}` stops the page itself panning sideways. Tables that already ship a mobile alternative (`hidden md:table`) are unaffected. Report KPI tiles changed `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` (three currency figures overlapped at 375px). Verified on the 6-month report at 375×812: no horizontal page scroll, tiles stacked, budget table scrolls internally.
- **Live phone-access card on the dashboard (IP kept changing — .21 → .30):** `GET /api/network/access` reads the machine's own interfaces via `os.networkInterfaces()` and returns `{port, urls[], qr}` — **private LAN ranges only** (10/172.16-31/192.168), a public address is never surfaced. QR generated server-side by the local `qrcode` python package (degrades to URL-only if absent). Dashboard card shows the current address with **📋 Copy** and a **▣ Show QR** toggle, refreshed on every state load, so a router reassigning the IP can never leave a dead link. The standalone file below is now a backup, not the source of truth.
- **Phone access page (backup): `~/Downloads/AnaHon_open_on_phone.html`** — scannable QR + the URL + setup steps (`qrcode` pip package installed for this). **Current URL `http://192.168.1.30:3000`** — note the Mac's IP moved from `.21` to `.30` today, so **regenerate the page (or re-check `ipconfig getifaddr en0`) whenever the phone stops connecting.** Requires the Mac awake with `npm run dev` running, same WiFi, trusted network only.

### 3a-untricies. One-click Arabic (العربية) — **1 Aug 2026**

- Header toggle **🌐 العربية / English** next to Sign Out. Sets `document.documentElement.lang` + **`dir="rtl"`** (whole UI mirrors) and persists in `localStorage["anahon-lang"]`.
- Scope is deliberate and matches the request: **navigation, section headers and primary actions only** — 19 nav labels + 6 section headers wired through `t()`, dictionary `AR` at the top of `App.tsx`. **Financial data, documents, vendor/project names and generated PDFs stay in the language they were entered in** — translating records would misrepresent signed instruments and donor-facing figures.
- To extend: add the English string as a key in `AR` and wrap the label in `t("…")`. Untranslated strings fall through to English by design, so a missing key is never a blank screen.
- Verified: toggle → Arabic + RTL, toggle back → English + LTR, choice survives reload.
- **Second pass same day — forms translated:** dictionary grown to **~155 entries**; **12 page titles** and **126 form labels** wrapped in `t()` across every tab (vouchers, banking, procurement, payroll, assets, partners, reports, funnel, production). Applied by script (`<h2 className="text-xl font-bold">` and simple `<label>` patterns), so only pure-text nodes were touched — no JSX was rewritten.
- ⚠️ Still English: placeholder text inside inputs, toast messages, table column headers, and long explanatory paragraphs. Deliberate — placeholders and helper prose are the least valuable to translate and the most likely to break layout. Add keys to `AR` and wrap as needed.

### 3a-tricies. Treasury card breakdown + petty cash disclosure — **1 Aug 2026**

User asked whether unspent petty cash should be added to the treasury pool and where the total comes from.

- **Deliberately NOT added.** The 1120 balance ($52,108) is *cash drawn at the bank minus cash vouchers documented* — a documentation gap, not provable notes in a drawer. Adding it would have overstated available funds ~13× ($4.2k → $56k) on the org's headline number. **Do not "fix" this by summing 1120 into the pool.**
- Treasury card now shows a **per-account breakdown** (BLOM USD 1,402.80 · BLOM EUR 2,421.58 → $2,762.05), keeping the as-of date, plus a separate amber line: *"$52,108.26 cash drawn but not yet documented (ledger 1120) — not counted above."* Same pattern as the pending-advice line.
**Both follow-ups BUILT same day:**

- **Petty cash count** — migration `20260801180000_cash_count` + `CashCount` model; `POST /api/cash/count` (Super Admin / Finance Officer only, no future dates, audit-logs counted vs 1120 book vs variance). Form in **Banking → 💵 Count the cash drawer** with the last three counts listed. **Counted notes ARE added to the treasury pool** (they are provable money); the remaining `1120 − counted` shows as the amber undocumented-gap line. **A count older than 45 days is excluded from the pool** and flagged for recount — a stale count must not inflate today's figure. Verified: role refused, future date refused, valid count $420 → pool $4,164.85 → $4,584.85 with gap $51,688.26. Test count removed.
- **Restricted balances per programme** — each stream card in Programs & Funnel now shows **Received / Spent** and **Unspent (restricted)**, computed from deposits carrying that project's id (any currency, converted; includes off-bank evidence accounts) less documented spend. Live: Platform $19,168.99 unspent · iContent $11,854.23 · Ahali Al Madina $7,049.24 · Core $8,877.68. Deliberately **not** presented as a slice of the bank balance — money is fungible and much of the difference sits in the undocumented petty gap.

### 3a-undetricies. Contract template defects fixed (user review) — **1 Aug 2026**

User read Omar's agreement and questioned three lines. All were real template flaws, now fixed in `contractHtml`, and his agreement was regenerated:

- **"Level of Effort 0%" and "Monthly Fee $0.00"** printed on a lump-sum engagement (I passed 0 for both, the template printed them regardless). Now both rows are **omitted when zero**, and the Fees clause switches to lump-sum wording: *"It is a lump-sum engagement: the total below covers the agreed scope for the whole period, payable in instalments on delivery and acceptance…"*. A signed instrument stating 0% effort for $0/month was both wrong and legally sloppy.
- **"Paid From: Against approved payment voucher — payee details: Cash"** — the template appended `Vendor.bankInfo` as "payee details"; Omar's is the literal string `"Cash"`. Now reads **"Against an approved payment voucher — paid in cash against a signed receipt"**, or the real transfer details when a vendor actually has them.
- **"Tax Registry ID: N/A"** suppressed (placeholder, same treatment as elsewhere).
- ⚠️ Remaining cosmetic weakness: a service agreement's **"Position / Role" is filled from `Vendor.category`**, so Omar's reads the generic "Service Provider" rather than "Field logistics & volunteer coordination". Fix by giving engaged providers a meaningful category, or add a role field to the contract form.

### 3a-septemvicesies. Provider invoice & payment receipt generator — **1 Aug 2026**

User wants the system to own the paperwork for service providers and employees. Provider chain now complete: **service agreement → system-generated service invoice & payment receipt → signed → attached to the voucher.**

- `providerInvoiceHtml` + `POST /api/vendors/payment-doc { expenseId }` → **🖨️ Provider invoice** button on any voucher whose payee is `engageable` (suppliers are refused with a message pointing at the attach-invoice route — verified). Figures come **from the voucher, never re-typed**: gross / WHT 7.5% / net, agreement reference auto-found from the party's contract docs, countersignatory resolved from the User table. Files to `<project>/Invoice/`, links `partyId` + voucher, flips `hasAttachment`.
- **Honesty guards (deliberate):** the form states it is prepared for the provider's signature *because the provider does not issue their own invoices*, and is **not valid until signed** — it is never a fabricated third-party bill. Two fixes caught in review: internal voucher `purpose` text (containing cash-reconciliation notes) was printing on a provider-facing document → replaced with a neutral project line; `"N/A"` placeholders no longer render as contact/tax-ID.
- **Omar's document generated: ANH-DOC-00391** (PV-2026-134, gross $676.78 / WHT $50.76 / net $626.02, cites agreement ASFARI-2026-LER-SA-OA-2026-06). Print → Omar signs → scan → attach with 🧾.
- **Employee side DONE too:** `payslipHtml` + `POST /api/payroll/payslip { employeeId, month }` → **🧾 Payslip &lt;month&gt;** button on each employee card in Payroll (follows the `selectedTSMonth` picker; roles Super Admin / Finance Officer / HR). Pulls the employee record + that month's timesheet; **cost-allocation table shows which project funds which share**, using the same percentages as timesheet approval, with any unfunded remainder shown explicitly. Files to `GENERAL/Payslip/`, linked `partyId` so it lands in the person's party file.
  - **Nil payslips are honest by design:** all four employees currently have salary 0 (the "no project = no payroll" rule), so the document prints $0 and says so — *"a position carries a salary only while a project funds it; this record exists to document the month, not to assert a payment."*
  - **Statutory deductions show nil with a stated reason** — payroll-tax/CNSS treatment is pending the worker-classification decision with Jad Maaliki; the payslip says it must be reissued if that decision changes the month's figures. **Do not silently start deducting until that's settled.**
  - Verified on Saad/June-2026 (22 days, TRF-2026 20% allocation rendered correctly); test payslip removed afterwards.

**Two attachment paths per voucher (user request, 1 Aug):** 🧾 **Invoice** (the bill — category `Invoice`) and 📷 **Evidence** (distribution lists, delivery notes, purchase photos — category `Evidence`), filed into separate vault subfolders, multi-file select on both. Attached docs list under each voucher with icon + filename + ANH-DOC ref, click to open. The "Invoice secured / Invoice required to close" badge now derives from **invoice-category docs only** (was `hasAttachment`, which any upload flipped — an evidence photo alone used to read as "invoice secured"). Legacy `Voucher`-category uploads count as invoices.
**User already attached both LER invoice photos** (ANH-DOC-00389 → PV-2026-132, ANH-DOC-00390 → PV-2026-133). Outstanding: Omar's provider invoice on PV-2026-134.

**Gap found & fixed 1 Aug: no way to attach evidence to an already-posted voucher.** The creation form could attach one; afterwards nothing (the Banking tab even told users to "attach the receipt afterwards from the voucher drawer" — a control that never existed), so every recovered receipt was stranded. Added `handleVoucherDocUpload` + **📎 Attach invoice / ➕ Add evidence** on every voucher row in **Disbursement Vouchers** and in the project workspace's expense list (roles: Super Admin / Finance Officer / Project Lead / Project Officer). Reuses `/api/document/upload` (linkedRecordType Expense) — files land in the vault, get a unique ANH-DOC ref, and flip `hasAttachment`. Verified end-to-end via API then test artifacts removed (388 docs).

### 3a-duodetricies. Single-source waiver + procurement tightening — **DONE 1 Aug 2026**

The ">$300" block is **Policy 7.2 procurement**, not the petty-cash ceiling. A "trusted vendor" bypass was **rejected** (an exemption must travel with evidence, not with a name). Built the documented alternative instead. Migration `20260801160000_single_source_waiver`: `Procurement.singleSource`, `Procurement.approvedBy`, `Expense.procurementId`.

- **Waiver rules (server):** <3 quotations requires `singleSource` **and** ≥1 recorded quotation **and** a justification of ≥30 chars. Approval is now **role-gated** (Super Admin / Program Director / Finance Officer — it previously had *no* check at all) and audit-logs as "Single-Source Waiver Approved" quoting the stated reason.
- **Authority now matched to the purchase:** a >$300 voucher must name an **approved procurement belonging to the same project** (`procurementId`). Previously any approved RFQ anywhere on the project let every voucher through. Error message lists the approved options.
- **Two pre-existing defects fixed in the form:** it supported only **two** quotations (so a compliant 3-quote comparison was impossible), and it **fabricated a phantom bid** — `"Second Sourced Vendor", amount 0` — whenever B was blank. Third bid field added; only quotations actually obtained are sent; the invented default justification string is gone.
- UI: third bid block, amber single-source checkbox + guidance, waiver badge with approver on procurement cards, and a **Procurement authority** picker on the voucher form that appears above $300 and lists approved comparisons/waivers for the chosen project.
- Verified 8 rules end to end (2-quotes-no-waiver refused · thin reason refused · real waiver accepted · PO cannot approve · voucher without authority refused with options listed · waiver approved by master · voucher with authority passes · cross-project authority refused). Test artifacts removed (192 vouchers, 0 procurements).

**Inline waiver from the voucher form (user asked why it needed a separate tab) — DONE.** Reasoning kept explicit: the *check* is at voucher time (server), the Bids tab holds the *evidence*; procurement is meant to precede the spend, but AnaHon buys cash in emergencies, so the record can now be raised where the work happens without pretending the paperwork came first.
- `POST /api/procurement/waiver-inline` — same validation as the tab (≥30-char reason, supplier + price recorded), creates an identical `singleSource` Procurement, **auto-approved only if the caller's DB role is Super Admin / Program Director / Finance Officer**, otherwise `Under Evaluation` awaiting an officer. **`retrospective: true` prefixes the justification with "RETROSPECTIVE (purchase already made, waiver recorded afterwards)"** and says so in the audit entry — the timing is disclosed, never disguised.
- Voucher form above $300: "Competition genuinely not possible? ＋ raise a single-source waiver here" → inline amber panel (supplier / price prefilled from the voucher / reason / retrospective checkbox). On approval it attaches itself to the voucher automatically.
- Added `/api/procurement/waiver-inline` to the Project Officer POST allowlist (they may **raise**, never approve — verified: PO waiver lands `Under Evaluation`, and a PO raising on a project outside their scope is refused).
- **Omar cash reconciliation CLOSED (user: "omar - the mof"):** the $626.02 he retained is the **net**; grossed up to **PV-2026-134 gross $676.78, WHT 7.5% $50.76 → MoF (2315), net $626.02** on line A6, cash from petty cash. $2,900 advance fully accounted (1,150 + 1,123.98 + 626.02). **SA-OA-2026-06 remaining: $1,823.22 of $2,500.** ⚠ Provider invoice pending from user — **align PV-2026-134's date to the invoice date when filed** (currently 20-Jul, approximate). WHT payable now $60.89 total.
- Post-booking rebuild: **balanced (Dr=Cr 331,148.31), both bank ties exact**, petty cash **55,008.26 → 52,108.26 (−$2,900 = the full advance now documented)**. LER burn **$2,950.76 / 10,000 (29.5%)**.

### 3a-trestricies. Start an opportunity FROM the call + provider-agnostic AI — **DONE 3 Aug 2026**

User: *"I want to be able to first paste the link or the call or the document to open a new opportunity, not add it manually — AI assists, then build the rest of the project documents. It starts there."*

- **`askJson(prompt, schema)`** — one JSON model call that uses **Anthropic (`claude-opus-5`, adaptive thinking, `output_config.format` JSON schema) when `ANTHROPIC_API_KEY` is set, otherwise Gemini**. `@anthropic-ai/sdk` installed. Flipping providers is one line in `.env`, so the same feature can be judged on both — which is exactly how the ARIJ test below settled the question. `/api/opportunities/ai-assist` moved onto it too (schema-constrained now, no hand-written "return JSON exactly" prose).
- **`extractCallText(body)`** — extraction refactored out of the `call-source` route into a reusable function handling **link / PDF / .docx / .txt / pasted text**, throwing `BadCallSource` for anything the user can fix (route maps it to 400). The route is now a 3-line wrapper. *A first attempt passed a fake `res` object into the old route body — replaced, it was unreadable.*
- **`POST /api/opportunities/intake`** — read the call, then in one pass propose **title, donor, stream, amount, currency, deadline, notes** *and* the **fit assessment** (fit / rationale / risks / angle / missing info). Donor is matched case-insensitively against existing donors; unmatched funders come back as `donorIsNew`. Returns a **draft only** — the same untrusted-DATA prompt hardening as `ai-assist`, and nothing is persisted.
- **`/api/opportunities/save` accepts `donorName`** — registers a prospect donor when the call names a funder we don't have, rather than making the user break off mid-flow. Audit-logged as "Donor Created … from a funding call intake."
- UI (Programs & Funnel): **🤖 Start from a call** → link box / upload / paste → prefills the *normal editable* opportunity form and pins the assessment above it, colour-coded by fit, with the new-donor notice and "Draft only. Nothing is in the pipeline until you press Save."
- **Verified end to end** on the real ARIJ call: `arij.net` fetched → 7,634 chars extracted → donor identified → form prefilled → assessment banner + new-donor notice rendered → save clears intake state.
- ⚠ **The test also produced the provider verdict.** `gemini-3.5-flash` returned **only the donor name** — title, amount, deadline, stream, rationale, risks all empty — although the extracted Arabic text plainly states a **USD 10,000** grant, a **10 Aug 2026 16:00 Amman** deadline, 3 orgs selected, 6 months from Sept 2026, and two reporting dates. Extraction was not the weak link; the model was. **Set `ANTHROPIC_API_KEY` and re-run the same button on the same call to compare.**

### Pending user input (31 Jul evening)
- **Subscription receipts reconciliation:** Gmail holds Anthropic receipts 26 Jun $20 (on statement 29 Jun $20.80, unlinked to voucher PV-TRF-004), 20 Jul $96.32 (Max 5x) and 31 Jul $134.97 (Max 20x) — user confirms all paid from BLOM card (receipt shows card …5063) and **will supply the newer bank statement**; book all four + Photoroom 26 Jun $5.79 (no voucher) when it arrives, then re-run `rebuild-ledger.ts`. Proposed funding line: MediaMig 14% admin allowance (helps 75% liquidation).

### 3b. ~~Move the vault to cloud storage~~ — **DROPPED 30 Jul 2026 (user decision: build all local)**

The vault stays at `~/Downloads/AnaHon_Document_Vault`. Consequence to accept knowingly: 298 registered files with **no backup**, against §13.6 (weekly external + quarterly off-site) and §13.4.1 (secure cloud archive). A local scheduled copy to an external disk would close most of this without any cloud sync — offer it if the user wants it later.

If this is ever revisited: set `ANAHON_VAULT=<new path>` in `.env` (the server already reads it) and **never** put `prisma/dev.db` in a synced folder — SQLite + cloud sync corrupts.

---

## 4. Open items with money or deadlines attached

| Due | Item |
|---|---|
| **URGENT — supersedes the two lines below** | **FULL TAX REGULARIZATION.** User disclosure 31-Jul-2026: **no MoF declaration of any kind has ever been filed since registration** (Civil Partnership **90/2023**, registered **12-Oct-2023**, Commercial Register Tripoli — certificates filed in vault `GENERAL/Legal/`). Spans fiscal 2023–2026 with ~$70k donor income in the last 12 months alone. CNSS registration may never have existed either — verify first. Engage the accountant/external auditor for a regularization plan; the rebuilt bank-tied ledger is the factual basis. Also settle the employee-vs-service-provider classification in the same sitting. Compliance tasks + calendar events reframed accordingly. |
| ~~overdue~~ | ~~CNSS employee subscription report (was 15 Jun); MoF Chapter 3 payroll tax filing (was 15 Jul)~~ — absorbed into the regularization item above |
| **31 Jul** | **Send the TRF reply to Luisa** — draft is in Gmail, ready. Sending it releases **USD 4,990.57**. |
| **1 Aug** | Asfari LER implementation window closes |
| **~5 Aug** | Confirm Brussels seat (FPU/EU closure event 1–2 Oct), then start the Schengen visa |
| **31 May 2027** | Asfari End-of-Grant Report (per Grant Offer — the old "15 Aug" date was a placeholder; the Year Plan *activities* window ends 01-Aug-2026). Still ask Asfari about the **$5,000 of the $10,000 grant not covered by the approved plan** |
| **31 Aug** | Restore Policy §4.2 roles before go-live (Saad → Program Director, Marwan → Finance Officer; remove the temporary Super Admin) |

**Two Gmail drafts are written and waiting to be sent by the user:**
- **Luisa Mendoza (TRF)** — clarification response + view-only OneDrive link to the 6-file response folder. Ready as-is.
- **Nada Hamad (Asfari)** — LER progress update. **Has five `>>> CONFIRM:` placeholders** the user must fill with real progress facts (which distributions happened, how many families, dates). Do not invent these.

---

## 5. Known-wrong, deliberately deferred

1. ~~The general ledger is not rebuilt.~~ **REBUILT 30 Jul 2026** — `prisma/rebuild-ledger.ts` (idempotent: wipes + regenerates all 357 entries from statement lines + vouchers). Invariants: bank accounts 1100/1110 are touched **only** by statement lines (so they tie to statements by construction — verified $1,402.80 / €2,421.58 exact); vouchers accrue via 2100 AP (card) or 1120 petty cash (cash); card statement lines settle their matched voucher's AP; nothing guessed — unidentifiable money sits in 2900 Suspense. Dr = Cr = $219,335.19; A = L+E+R−Exp holds. Chart renamed off "Bank Audi" to BLOM. Live flow aligned (WHT → 2315). **Honest residuals the rebuild exposed, for the user to resolve:**
   - **1120 Petty Cash shows $44,624.69** (was 47,636.69 — reduced $3,012 on 31 Jul by documenting the June rent, PV-2026-130/131) — cash drawn at the bank minus cash vouchers documented. This is the real historical documentation gap made visible, not an error. Deliberately NOT reclassified to drawings/salaries without evidence. Every receipt recovered shrinks it.
   - **2900 Suspense $1,405** — 'Trf From 068…' transfers ($1,355) + $50 cash deposit, origin unidentified.
   - **2100 AP $1,696.67** — FHI360 pass-through ($1,494.19, treated as owed onward, not income) + 7 card vouchers ($202.48) whose spends never appear on the statement (likely paid from a personal card — confirm).
   - ⚠️ Future statement imports must NOT re-post lines already settled by voucher JEs (`glpost` credits the bank directly) — the importer needs a skip-matched rule, or re-run `rebuild-ledger.ts` after each import.
2. **EUR converts at today's rate** (1.1406) throughout, including the rebuilt journal (documented per entry; rounding trued up via ADJ-FX-ROUNDING). Historical-rate FX remains open.
3. **Roles are client-supplied** — every endpoint reads `user` from `req.body`. A caller can claim any role. The `approve` action has no role check at all, and nothing stops a requester approving their own voucher (violates §4.3 segregation of duties). **The most serious control weakness.**
4. Missing threshold enforcement: petty-cash $300 ceiling, >$1,000 enhanced controls (`approvalThresholdUSD` is stored but never read), documentation gate before payment, quotation counts, $100 asset capitalization, depreciation never runs.
5. `prisma/dev.db` is out of future commits but **still in past commit history** — full purge needs `git filter-repo`.
6. UI still hardcodes wrong officer names in the voucher signature block (`App.tsx` ~2721: "Layale Ghorayeb", "Farah Shami") — these print onto donor-facing documents.
7. Vercel deployment is stale (June build) and would have no database.

---

## 6. Working conventions established

- **AI prefills, humans decide.** Both scanners (invoice → voucher, invoice → vendor) only fill forms; they never submit. Model-returned IDs are validated against the DB before use.
- **Never fabricate donor-facing numbers.** Placeholders are left explicit for the user to fill.
- **Never backdate documents.** When paperwork needed correcting (the TRF timesheet dispute), the fix was an *Addendum dated today* plus reissued timesheets stating the corrected basis openly — not rewritten originals. §6.8/§14.2 treat backdating as fraud.
- **Every data change is audit-logged** to `AuditLog` with who/what/why.
- Document filenames follow §13.4.1: `YEAR_PROJECTCODE_BUDGETLINE_DOCTYPE_VENDOR_AMOUNT`.
- Report PDFs export as `YEAR_ANAHON_<ANNUAL|SEMI-ANNUAL>-FINANCIAL-REPORT_<start>_to_<end>.pdf`.

---

## 7. Useful commands

```bash
# run the app
cd /Users/saadmatar/antigravity/AnaHon-Financial-Management-System && npm run dev

# merge this work into main when ready
git checkout main && git merge feat/reports-ai-scan-bank-import && git push

# generate a report via API (6 or 12 months)
curl -s "http://localhost:3000/api/reports/period?months=12&end=2026-07" | python3 -m json.tool | head -40
```
