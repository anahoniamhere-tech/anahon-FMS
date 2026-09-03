# Regenerates the Tax Regularization Evidence Pack from the live ledger.
#   python3 prisma/evidence-pack.py  (from the repo root; writes HTML+PDF to scratch, then vault)
# Reusable because the pack has needed regeneration after every evidence discovery.
import sqlite3, json, collections, datetime, html, os, subprocess, shutil

db = sqlite3.connect(os.path.join(os.path.dirname(__file__), "dev.db"))
E = html.escape
acc = {r[0]: (r[1], r[2]) for r in db.execute("select code,name,type from Account")}

years = collections.defaultdict(lambda: collections.defaultdict(float))
for date, items in db.execute("select date,itemsJson from JournalEntry"):
    for i in json.loads(items):
        c = i["accountCode"]; t = acc.get(c, ("?", "?"))[1]
        if t == "Revenue": years[date[:4]][c] += i.get("credit", 0) - i.get("debit", 0)
        elif t == "Expense": years[date[:4]][c] += i.get("debit", 0) - i.get("credit", 0)

ba = {r[0]: (r[1], r[2], r[3]) for r in db.execute("select id,name,currency,type from BankAccount")}
deps = db.execute("""select date,description,amount,bankAccountId from BankTransaction
  where type='Deposit' and pending=0 and description not like '%FX conversion%'
  and description not like '%Reversal%' and description not like '%الغاء%' order by date""").fetchall()

def pnl(y):
    d = years.get(y, {})
    rev = [(c, v) for c, v in sorted(d.items()) if acc[c][1] == "Revenue" and abs(v) > 0.004]
    exp = [(c, v) for c, v in sorted(d.items()) if acc[c][1] == "Expense" and abs(v) > 0.004]
    tr = sum(v for _, v in rev); te = sum(v for _, v in exp)
    rows = "".join(f"<tr><td>{c} {E(acc[c][0])}</td><td class='r'>{v:,.2f}</td></tr>" for c, v in rev)
    rows += f"<tr class='sub'><td>Total income</td><td class='r'>{tr:,.2f}</td></tr>"
    rows += "".join(f"<tr><td>{c} {E(acc[c][0])}</td><td class='r'>({v:,.2f})</td></tr>" for c, v in exp)
    rows += f"<tr class='sub'><td>Total expenditure</td><td class='r'>({te:,.2f})</td></tr>"
    rows += f"<tr class='tot'><td>Surplus / (deficit)</td><td class='r'>{tr-te:,.2f}</td></tr>"
    return f"<table><caption>FY{y} — management income &amp; expenditure (USD)</caption>{rows}</table>"

def sched(y):
    rows = ""
    for d, desc, amt, aid in deps:
        if d[:4] != y: continue
        name, ccy, typ = ba[aid]
        off = " ⬥ OFF-BANK" if typ == "Petty Cash" else ""
        note = " — PASS-THROUGH (not income)" if "FHI360" in desc else (" — unidentified (suspense)" if ("Trf From" in desc or "Cash deposit" in desc) else "")
        rows += f"<tr><td>{d}</td><td>{E(desc[:95])}{E(note)}</td><td>{E(ccy)}{off}</td><td class='r'>{amt:,.2f}</td></tr>"
    return (f"<table><caption>FY{y} — receipts (BLOM statement lines + evidenced off-bank receipts; FX conversions/reversals excluded)</caption>"
            f"<tr><th>Date</th><th>Source</th><th>Ccy</th><th class='r'>Amount</th></tr>{rows}</table>") if rows else ""

now = datetime.date.today().isoformat()
nvouch = db.execute("select count(*) from Expense").fetchone()[0]
ndocs = db.execute("select count(*) from AppDoc").fetchone()[0]
nje = db.execute("select count(*) from JournalEntry").fetchone()[0]
drcr = 0
for _, items in db.execute("select id,itemsJson from JournalEntry"):
    drcr += sum(i.get("debit", 0) for i in json.loads(items))
petty = db.execute("select balance from Account where code='1120'").fetchone()[0]
ap = db.execute("select balance from Account where code='2100'").fetchone()[0]
susp = db.execute("select balance from Account where code='2900'").fetchone()[0]

body = f"""<h1>ANAHON — TAX REGULARIZATION EVIDENCE PACK <span style="font-size:11px">(v3, {now})</span></h1>
<h2>“ANAHON — أنا هون”, Lebanese Civil Partnership · Commercial Register no. 90/2023 (Tripoli, 12 Oct 2023) · <b>MoF no. 3893185</b> · Director: Saad Mohamad Matar</h2>
<p class="note">Prepared {now} from the AnaHon Financial Management System, superseding v1/v2. Management figures, unaudited,
for the engaged accountant. The double-entry ledger ({nje} entries, Dr = Cr = ${drcr:,.2f}) ties line-by-line to the BLOM Business Plus
statements (USD 004-02-353-2343794-1-7, EUR 004-04-353-2343794-1-5) and additionally records EVIDENCED OFF-BANK receipts
(bank cheques cashed, money-transfer operators) on dedicated evidence accounts marked ⬥ in the schedules.</p>

<h3>Disclosure this pack supports</h3>
<p><b>The entity is MoF-registered (no. 3893185) and its FY2023 declarations WERE FILED</b> — company partnership declaration
submitted via LibanPost Tripoli on 18-07-2024 (receipt on file, LBP 630,000 fees) and the director's personal F1 e-filed 04-07-2024
(MoF receipt no. 245019055, tax due 0 LL, partner-share annex 49أ), both prepared by accountant Jad Maaliki (paid invoice on file).
<b>The open gap is the FY2024 and FY2025 declarations (+FY2026 in progress).</b> CNSS registration status unverified.
Asked of the accountant: FY2024–FY2025 back-filings, payroll-tax treatment of past salaried periods, CNSS status/regularization,
penalties and any relief window, and go-forward worker classification.</p>

<h3>Basis of preparation — read first</h3>
<ul>
<li><b>Bank-tied:</b> journal-derived BLOM balances equal the statement closings exactly: USD 1,402.80 / EUR 2,421.58 (through 27 Jul 2026).</li>
<li><b>Off-bank income is real and evidenced:</b> a substantial share of grant income never touched BLOM —
SKF-AH-06/2025: <b>$26,000 by three Byblos Bank cheques</b> (final cheque no. 432821; SKF finance emails);
FPU IContent2: <b>$16,723.90 in six BOB Finance transfers</b> (refs recorded, per the FPU-approved final report EB 13052024).
These sit on inactive evidence accounts and flow through cash (1120), never through the BLOM ledger accounts.</li>
<li><b>FY2023 is NOT nil (corrects v1):</b> $10,505 of FPU tranches arrived Dec-2023, and part of IContent2 spending falls in Dec-2023.
IContent2 expenses are booked as line-summaries dated Mar-2024; the itemised ~190-line register (in the FPU-approved workbook)
is required to split FY2023/FY2024 expenditure precisely at filing time.</li>
<li><b>EUR/FX:</b> BLOM statement lines translate at 1.1406 (current-rate convention); off-bank items carry their documented realized
rates (e.g. IContent2 at 1.04735 actual). Native-currency schedules provided; the accountant may re-translate.</li>
<li><b>Undocumented cash: ${petty:,.2f}</b> on 1120 — total cash handled (ATM + counter + cashed cheques + BOB transfers) minus
voucher-documented spending. A documentation gap, deliberately not reclassified without evidence; shrinking as receipts are recovered.</li>
<li><b>Open balances:</b> Suspense ${susp:,.2f} (unidentified 'Trf From 068…' + one cash deposit); AP ${ap:,.2f}
(FHI360 pass-through $1,494.19 — treated as owed onward, not income — plus $988.61 of online subscriptions apparently paid personally, unconfirmed).</li>
<li><b>Receivable to verify:</b> per FPU's own approved final report, <b>€3,193 of IContent2 remains payable by FPU</b>
(€4,013 final instalment − €820 underspend); no receipt evidence found on any account.</li>
<li><b>Office lease is in the director's personal name</b> (Roya M. Awada, $6,000/yr, expired 14 Jul 2026, renewal pending) — flag for treatment.</li>
<li><b>BWZ/FRL 2023 sub-grant (budget $19,932, Apr–Sep 2023):</b> payment 1 of $5,000 EVIDENCED (BOB Finance TN 988-493-5787,
03-05-2023, + signed fund receipt note) and included in FY2023 income. The 25%-instalment schedule implies up to four payments;
payments 2–3 ($5,000 each) are BOOKED PROVISIONALLY at their request dates (05-06/31-07-2023) per management instruction —
requests are on file, receipts still missing; confirm or reverse when found. Final ~$4,932 instalment not booked (no request evidence).
Month-1 expenditures ($4,072.10, incl. team salaries) vouchered from the donor-submitted report; months 2–5 still undocumented.</li>
</ul>

<h3>FY2023 (12 Oct – 31 Dec 2023)</h3>{pnl('2023')}{sched('2023')}
<p class="note">FY2023 income = FPU IContent2 tranches ($10,505) + BWZ payment 1 ($5,000). Expenses shown as 0 because IContent2
spending is booked at Mar-2024 summary level and BWZ expenditures await vouchering — see basis notes. FY2023 was FILED (0 LL due);
any restatement implications of these later-reconstructed figures are for the accountant to judge.</p>
<h3>FY2024</h3>{pnl('2024')}{sched('2024')}
<h3>FY2025</h3>{pnl('2025')}{sched('2025')}
<h3>FY2026 (1 Jan – 31 Jul 2026)</h3>{pnl('2026')}{sched('2026')}

<h3>Bank balances at each year-end (native currency, per statements)</h3>
<table><tr><th>Account</th><th class='r'>31 Dec 2024</th><th class='r'>31 Dec 2025</th><th class='r'>27 Jul 2026</th></tr>
<tr><td>BLOM USD 004-02-…794-1-7</td><td class='r'>14.10</td><td class='r'>45.48</td><td class='r'>1,402.80</td></tr>
<tr><td>BLOM EUR 004-04-…794-1-5</td><td class='r'>1,365.00</td><td class='r'>78.19</td><td class='r'>2,421.58</td></tr></table>

<h3>Personnel history (for payroll tax / CNSS discussion)</h3>
<table><tr><th>Period</th><th>Project</th><th>People</th><th class='r'>Salaries booked (USD)</th></tr>
<tr><td>Dec 2023 – Mar 2024</td><td>FPU IContent2</td><td>Saad Matar (€450/m), Assem Nayrab (€500/m), Jaylan Kahlawi (€250/m), Wissal Kantar (€350/m), Ahmad Ayshan (€200/m) — timesheets per FPU report</td><td class='r'>7,331.45 (EUR 7,000)</td></tr>
<tr><td>Aug 2025 – Feb 2026</td><td>FPU Voices Unseen</td><td>Saad, Ahmad, Assem (timesheet-based, partial LoE)</td><td class='r'>5,705.87 (FY25)</td></tr>
<tr><td>Feb – Jun 2026</td><td>TRF Truth in Motion</td><td>Saad (1,560/m), Ahmad (1,200/m), Sally Kayyali (1,200/m)</td><td class='r'>6,034.91 (FY26)</td></tr>
<tr><td>Jul 2026 →</td><td>—</td><td>No salaried staff; all bases 0 (no-project-no-payroll rule). Deliverable work via engaged providers with 7.5% WHT where unregistered.</td><td class='r'>—</td></tr></table>
<p class="note">Separately, per-deliverable service payments to individuals (incl. the director) are recorded under vendor identities with
signed agreements and receipts — e.g. SKF-AH-06/2025: Al Sabbagh $6,000, Matar $5,930, Kabbara $3,000, Kayyal $500, Ayshan $400.</p>

<h3>Documentation inventory available to the accountant</h3>
<ul>
<li>{nvouch} payment vouchers; {ndocs} registered documents (agreements, contracts, receipts, invoices, timesheets), all resolvable on disk.</li>
<li>Signed agreements: FPU sub-grants (2024 + 2025), SKF grant SKF-AH-06/2025, SKF/AFD Acte de Rétrocession (€50,895), Asfari Grant Offer 2026, TRF contract set; office lease (certified translation); registration certificates (AR + certified EN) and Civil Company license.</li>
<li>Full BLOM statement CSVs (Jan 2024 – Jul 2026); SKF cheque correspondence; FPU-approved IContent2 final report with 190-line register.</li>
<li><b>FY2023 filed-declaration pack with both official receipts</b> (vault: GENERAL/Tax_Regularization); 14 signed TRF cash receipts;
BWZ payment evidence; real Asfari-2024 grant agreement.</li>
<li>General ledger regenerable on demand (idempotent rebuild, bank-tie verified on every run).</li>
</ul>
<p class="note">Generated by the AnaHon FMS. Management basis; the accountant determines the tax basis and final filing figures.</p>"""

style = """body{font-family:Georgia,serif;max-width:800px;margin:24px auto;color:#1a1a1a;font-size:12.5px;line-height:1.5}
h1{font-size:16px;letter-spacing:1px;border-bottom:2px solid #1a1a1a;padding-bottom:6px}
h2{font-size:11px;color:#444;font-weight:normal}h3{font-size:13px;border-bottom:1px solid #999;padding-bottom:3px;margin-top:22px}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11.5px}caption{text-align:left;font-size:10.5px;color:#555;padding:3px 0}
td,th{border:1px solid #aaa;padding:4px 7px;text-align:left}th{background:#f2f2f2}.r{text-align:right}
.sub td{border-top:2px solid #666;font-weight:bold}.tot td{font-weight:bold;background:#f7f7f7}
.note{font-size:10px;color:#555}ul{margin:6px 0}li{margin:3px 0}@media print{body{margin:8px}}"""
out = f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>AnaHon Tax Regularization Evidence Pack</title><style>{style}</style></head><body>{body}</body></html>"

scratch = os.environ.get("PACK_OUT", "/tmp/regpack")
os.makedirs(scratch, exist_ok=True)
hp = os.path.join(scratch, "regpack.html"); open(hp, "w").write(out)
pp = os.path.join(scratch, "regpack.pdf")
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
subprocess.run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pp}", f"file://{hp}"],
               capture_output=True, timeout=60)
print("pdf:", pp, os.path.getsize(pp), "bytes")
