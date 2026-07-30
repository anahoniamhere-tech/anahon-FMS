# AnaHon FMS — session handoff (30 July 2026)

Paste this file's path into a new chat and say: **"Read HANDOFF.md and continue."**

---

## 1. Where everything lives

| Thing | Path / location |
|---|---|
| **The app** | `/Users/saadmatar/antigravity/AnaHon-Financial-Management-System` |
| **Database** | `prisma/dev.db` — **SQLite, local file only.** Untracked by git (deliberately). This IS the system of record. |
| **Document vault** | `~/Downloads/AnaHon_Document_Vault` — 284 files. **Local only, no backup.** App finds it here; override with `ANAHON_VAULT` env var. |
| **Policy brain** | `/Users/saadmatar/Obsidian/AMS/AMS` — Obsidian vault, 18 notes built strictly from the Accounting Policies Manual v020. Keep it manual-derived only; no project/donor content. |
| **Run the app** | `npm run dev` → http://localhost:3000 (Vite + Express + Prisma). Login is Firebase; `anahoniamhere@gmail.com` is **Super Admin** (temporary, see task below). |
| **Repo** | github.com/anahoniamhere-tech/anahon-FMS — work is on branch `feat/reports-ai-scan-bank-import`, **not yet merged to main**. |

Bank statements (source of truth for cash): `/Users/saadmatar/Documents/eBLOM_Stmt_004-02-…_1-7…csv` (USD) and `…004-04-…_1-5…csv` (EUR).

---

## 2. What the system currently holds

129 expense vouchers · 226 bank transactions · 284 documents · 4 employees · 34 timesheets · 11 vendors · 48 audit entries.

**Two projects, both reconciled to the bank:**
- **TRF-2026** "Truth in Motion" — Active, $10,020 budget, 100% burn, 52 vouchers. Ended 30 Jun 2026, closeout in progress.
- **FPU-2025** "Voices Unseen" — Completed and **fully settled** (EUR 20,313 received + 2,236 final on 02-Jul-2026), 77 vouchers.

**Bank (BLOM Business Plus, one account, two currency sub-accounts):**
- USD `004-02-353-2343794-1-7` → closing **$1,402.80**
- EUR `004-04-353-2343794-1-5` → closing **€2,421.58**
- Both tie exactly to their statements (movements = closing balance).

**12-month donor income: $70,447.05** from six sources — SKF (MediaMig €20,297.30 + services $1,651.38), FPU (€23,070), Asfari ($10,000), WeWorld ($4,301.50), TRF ($5,029.43).

---

## 3. Immediate next step (what the user was about to do)

**Move the document vault to cloud storage.** It is 284 files in `~/Downloads` with no backup — the single largest risk in the system. Policy §13.6 requires weekly external + quarterly off-site backup; §13.4.1 requires a secure cloud archive.

Plan:
1. Ask the user: Google Drive or OneDrive (both are already in use).
2. Move `~/Downloads/AnaHon_Document_Vault` into that synced folder.
3. Set `ANAHON_VAULT=<new path>` in `.env` — the server already reads it (`server.ts`, document upload/serve paths).
4. Verify a few documents still open from the app (Projects → TRF → documents; voucher drawer → Details).
5. **Do NOT put `prisma/dev.db` in a synced folder** — SQLite + cloud sync corrupts. It needs a scheduled copy instead (offer to script a nightly backup).

---

## 4. Open items with money or deadlines attached

| Due | Item |
|---|---|
| **overdue** | CNSS employee subscription report (was 15 Jun); MoF Chapter 3 payroll tax filing (was 15 Jul) |
| **31 Jul** | **Send the TRF reply to Luisa** — draft is in Gmail, ready. Sending it releases **USD 4,990.57**. |
| **1 Aug** | Asfari LER implementation window closes |
| **~5 Aug** | Confirm Brussels seat (FPU/EU closure event 1–2 Oct), then start the Schengen visa |
| **15 Aug** | Asfari End-of-Grant Report; and ask Asfari about the **$5,000 of the $10,000 grant not covered by the approved plan** |
| **31 Aug** | Restore Policy §4.2 roles before go-live (Saad → Program Director, Marwan → Finance Officer; remove the temporary Super Admin) |

**Two Gmail drafts are written and waiting to be sent by the user:**
- **Luisa Mendoza (TRF)** — clarification response + view-only OneDrive link to the 6-file response folder. Ready as-is.
- **Nada Hamad (Asfari)** — LER progress update. **Has five `>>> CONFIRM:` placeholders** the user must fill with real progress facts (which distributions happened, how many families, dates). Do not invent these.

---

## 5. Known-wrong, deliberately deferred

1. **The general ledger is not rebuilt.** ~$9,895 of TRF cash disbursements exist as vouchers but were never posted to a cash/bank account, and the 49 imported FPU/TRF vouchers have no journal entries. The journal cannot reproduce the ledger. Every generated report prints this as a caveat. **This is the biggest accounting gap.**
2. **EUR converts at today's rate** (1.1406), not the rate on each transaction date. Historical-rate FX belongs with the GL rebuild.
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
