/**
 * FMS → Obsidian sync.
 *
 * Regenerates ONLY the factual blocks in the vault, delimited by
 *   <!-- fms:start KEY --> … <!-- fms:end KEY -->
 * Everything outside those markers is prose someone wrote and is never touched.
 * A note with no markers is left completely alone.
 *
 * The app is the system of record for numbers; the vault is the system of record
 * for judgement. This keeps the first from going stale without overwriting the second.
 *
 *   npx tsx scripts/sync-obsidian.ts          # write
 *   npx tsx scripts/sync-obsidian.ts --check  # report drift, change nothing (CI-friendly)
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import os from "os";

const VAULT = process.env.ANAHON_VAULT || path.join(os.homedir(), "Obsidian/AMS/AMS");
const CHECK = process.argv.includes("--check");
const prisma = new PrismaClient();

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = new Date().toISOString().slice(0, 10);

/** Replace one marked block. Returns null when the note has no such block.
 *  Uses a function replacer — the content is full of "$" amounts and a string
 *  replacement would read "$1" as a backreference and eat the digits. */
function replaceBlock(body: string, key: string, content: string): string | null {
  const re = new RegExp(`(<!-- fms:start ${key} -->)[\\s\\S]*?(<!-- fms:end ${key} -->)`);
  if (!re.test(body)) return null;
  return body.replace(re, (_m, open: string, close: string) => `${open}\n${content}\n${close}`);
}

async function build() {
  const [projects, donors, expenses, txs, opportunities, subs, docs, activities, accounts] =
    await Promise.all([
      prisma.project.findMany(), prisma.donor.findMany(), prisma.expense.findMany(),
      prisma.bankTransaction.findMany(), prisma.opportunity.findMany(),
      prisma.subscription.findMany(), prisma.appDoc.findMany(),
      prisma.projectActivity.findMany(), prisma.bankAccount.findMany()
    ]);

  const donorName = (id: string) => donors.find(d => d.id === id)?.name || "—";
  // Money actually committed: anything past approval. Draft/returned vouchers are not spend.
  const COUNTED = ["Approved", "Paid", "Posted"];
  const spentOf = (pid: string) => expenses
    .filter(e => e.projectId === pid && COUNTED.includes(e.status))
    .reduce((s, e) => s + e.convertedAmount, 0);
  // Bank proof only: pending advice lines never count as received.
  const receivedOf = (pid: string) => txs
    .filter(t => t.projectId === pid && t.type === "Deposit" && !t.pending)
    .reduce((s, t) => s + t.amount, 0);

  const blocks: Record<string, string> = {};

  for (const p of projects) {
    const spent = spentOf(p.id), received = receivedOf(p.id);
    const pct = p.budgetUSD ? (spent / p.budgetUSD) * 100 : 0;
    const acts = activities.filter(a => a.projectId === p.id);
    const done = acts.filter(a => a.status === "Done").length;
    blocks[`project:${p.code}`] = [
      `| | |`, `|---|---|`,
      `| Donor | ${donorName(p.donorId)} |`,
      `| Programme | ${p.stream || "unassigned"} |`,
      `| Grant period | ${p.startDate} → ${p.endDate} |`,
      `| Budget | **${usd(p.budgetUSD)}** |`,
      `| Received (bank-confirmed) | ${usd(received)}${received < p.budgetUSD ? ` — **${usd(p.budgetUSD - received)} outstanding**` : ""} |`,
      `| Spent | ${usd(spent)} (${pct.toFixed(1)}%) |`,
      `| Unspent | ${usd(p.budgetUSD - spent)} |`,
      `| Vouchers | ${expenses.filter(e => e.projectId === p.id).length} |`,
      `| Documents on file | ${docs.filter(d => d.linkedRecordId === p.id || d.linkedRecordType === p.code).length} |`,
      `| Timeline steps | ${acts.length}${acts.length ? ` (${done} done)` : ""} |`,
      `| Status | ${p.status} |`,
      ``, `*Figures from the AMS app, ${today}. Edited here they will be overwritten — fix them in the app.*`
    ].join("\n");
  }

  blocks["portfolio"] = [
    `| Project | Donor | Budget | Received | Spent | Status |`,
    `|---|---|---:|---:|---:|---|`,
    ...projects.sort((a, b) => a.code.localeCompare(b.code)).map(p =>
      `| ${p.code} | ${donorName(p.donorId)} | ${usd(p.budgetUSD)} | ${usd(receivedOf(p.id))} | ${usd(spentOf(p.id))} | ${p.status} |`),
    ``,
    `**${projects.length} projects · ${donors.length} donors · ` +
    `${usd(projects.reduce((s, p) => s + p.budgetUSD, 0))} committed · ` +
    `${usd(projects.reduce((s, p) => s + receivedOf(p.id), 0))} received · ` +
    `${usd(projects.reduce((s, p) => s + spentOf(p.id), 0))} spent**`,
    ``, `*Generated from the AMS app, ${today}.*`
  ].join("\n");

  // The funnel has no vault note today — this block gives it one.
  const STAGES = ["Awarded", "Submitted", "Drafting", "Prospect", "Declined"];
  blocks["pipeline"] = [
    `| Opportunity | Donor | Programme | Stage | Ask | Deadline |`,
    `|---|---|---|---|---:|---|`,
    ...opportunities
      .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || (a.deadline || "z").localeCompare(b.deadline || "z"))
      // Opportunities are asked for in the funder's own currency — never stamp them all "$".
      .map(o => {
        const ask = o.amount
          ? `${o.currency === "USD" ? "$" : o.currency === "EUR" ? "€" : o.currency + " "}${o.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
          : "—";
        return `| ${o.title} | ${donorName(o.donorId)} | ${o.stream || "—"} | ${o.stage} | ${ask} | ${o.deadline || "—"} |`;
      }),
    ``,
    `*${opportunities.length} live opportunities. Forward-looking only — nothing here is income until a bank deposit registers a project. Generated ${today}.*`
  ].join("\n");

  blocks["donors"] = [
    `| Donor | Projects | Committed | Received |`,
    `|---|---|---:|---:|`,
    ...donors.map(d => {
      const ps = projects.filter(p => p.donorId === d.id);
      return `| ${d.name} | ${ps.length ? ps.map(p => p.code).join(" · ") : "—"} | ${usd(ps.reduce((s, p) => s + p.budgetUSD, 0))} | ${usd(ps.reduce((s, p) => s + receivedOf(p.id), 0))} |`;
    }),
    ``, `*${donors.length} donors on record. Generated ${today}.*`
  ].join("\n");

  // Treasury: what is actually available, kept apart from what has merely been drawn.
  // Ledger 1120 is cash out of the bank but not yet evidenced by a voucher — it is a
  // documentation gap, not spending money, and must never be added into a headline total.
  const ledger = await prisma.account.findMany({ where: { code: { in: ["1100", "1110", "1120", "2315", "2900"] } } });
  const bal = (code: string) => ledger.find(a => a.code === code)?.balance ?? 0;
  const counts = await prisma.cashCount.findMany({ orderBy: { date: "desc" }, take: 1 });
  const lastCount = counts[0];
  const pettyGap = bal("1120");

  blocks["treasury"] = [
    `### Available`, ``,
    `| Account | Currency | Balance |`, `|---|---|---:|`,
    ...accounts.filter(a => a.active && a.type === "Bank")
      .map(a => `| ${a.name} | ${a.currency} | ${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} |`),
    ``,
    `### Drawn but undocumented`, ``,
    `| | |`, `|---|---:|`,
    `| Petty cash (ledger 1120) | **${usd(pettyGap)}** |`,
    `| Last physical count | ${lastCount ? `${lastCount.date} — ${usd(lastCount.countedUSD)} counted, variance ${usd(lastCount.countedUSD - pettyGap)}` : "**never counted**"} |`,
    ``,
    `> ⚠️ Ledger 1120 is cash withdrawn from the bank that has **no voucher against it yet**. It is a documentation gap, not available funds, and it is larger than both bank balances combined. ${lastCount ? "" : "**No physical cash count has ever been recorded**, so the real variance is unknown — record one in the app (Banking → Cash Count) to separate actual notes in hand from the gap."}`,
    ``,
    `### Other ledger positions`, ``,
    `| | |`, `|---|---:|`,
    `| WHT payable to MoF (2315) | ${usd(bal("2315"))} |`,
    `| Suspense — unidentified receipts (2900) | ${usd(bal("2900"))} |`,
    ``,
    `**${expenses.length} vouchers · ${docs.length} documents · ${activities.length} timeline steps · ${subs.length} subscription${subs.length === 1 ? "" : "s"} tracked**`,
    ``, `*Generated ${today}. Figures from the AMS app — fix them there, not here.*`
  ].join("\n");

  return blocks;
}

async function main() {
  const blocks = await build();
  const files = fs.readdirSync(VAULT, { recursive: true, encoding: "utf8" })
    .filter(f => f.endsWith(".md"))
    .map(f => path.join(VAULT, f));

  let written = 0, drifted = 0, unmatched = new Set(Object.keys(blocks));

  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    let after = before;
    for (const [key, content] of Object.entries(blocks)) {
      const next = replaceBlock(after, key, content);
      if (next !== null) { after = next; unmatched.delete(key); }
    }
    if (after === before) continue;
    drifted++;
    const rel = path.relative(VAULT, file);
    if (CHECK) { console.log(`  drift: ${rel}`); continue; }
    // Stamp the note's own freshness date so staleness is visible at a glance.
    after = after.replace(/^(updated:\s*).*$/m, `$1${today}`);
    fs.writeFileSync(file, after);
    console.log(`  synced: ${rel}`);
    written++;
  }

  console.log(CHECK
    ? `\n${drifted} note(s) out of date. Run without --check to update.`
    : `\n${written} note(s) synced.`);
  if (unmatched.size) {
    console.log(`\nBlocks with nowhere to go (add the markers to a note to use them):`);
    for (const k of unmatched) console.log(`  <!-- fms:start ${k} --><!-- fms:end ${k} -->`);
  }
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
