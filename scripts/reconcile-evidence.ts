// Triage the evidence backlog: for every posted voucher with no supporting document,
// work out WHERE the evidence would come from, and rank by whether it is recoverable.
//
// Reads only. Proposes; links nothing. Attaching a document to a voucher is an
// assertion about the books, and it should be a person's decision, not a script's.
//
//   npx tsx scripts/reconcile-evidence.ts            summary
//   npx tsx scripts/reconcile-evidence.ts --csv      also write the worklist to the vault
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import os from "os";
import path from "path";

const prisma = new PrismaClient();
const VAULT = process.env.ANAHON_VAULT || path.join(os.homedir(), "Downloads", "AnaHon_Document_Vault");
const COUNTED = ["Approved", "Paid", "Posted"];

/** Where a missing document can actually be recovered from. Ordered by how cheap it is to get. */
const ROUTES = [
  {
    key: "email",
    label: "Email receipt",
    how: "Vendor emails a receipt for every charge — search the mailbox and file it.",
    test: (t: string) => /openai|runway|eleven ?labs|anthropic|claude|google|adobe|canva|higgsfield|midjourney|notion|zoom|dropbox|apple|microsoft|chatgpt|gemini|perplexity|metricool|buzzsprout/i.test(t)
  },
  {
    key: "provider",
    label: "Provider bill",
    how: "Re-request from the utility or ISP; they reissue on demand.",
    test: (t: string) => /electric|internet|generator|water|fuel|كهرباء|انترنت|مولد/i.test(t)
  },
  {
    key: "party",
    label: "Signed by a person",
    how: "Contract or receipt signed by the payee — re-issue and re-sign if lost.",
    test: (t: string) => /salary|fee|honorar|trainer|consultant|designer|editor|creator|podcast|rent|أتعاب|راتب|إيجار/i.test(t)
  },
  {
    key: "counter",
    label: "Counter receipt",
    how: "Shop or driver receipt. Recoverable only if it was kept.",
    test: (t: string) => /taxi|transport|vip|notebook|pens|supplies|print|نقل|قرطاسية/i.test(t)
  }
];

const route = (text: string) => ROUTES.find(r => r.test(text)) || { key: "unknown", label: "Unclassified", how: "Needs a human to say what this was." };

async function main() {
  const writeCsv = process.argv.includes("--csv");
  const [expenses, docs, projects] = await Promise.all([
    prisma.expense.findMany(), prisma.appDoc.findMany(), prisma.project.findMany()
  ]);
  const codeOf = new Map(projects.map(p => [p.id, p.code]));
  const closed = new Map(projects.map(p => [p.id, p.status === "Completed"]));

  // Same rule the dashboard uses: neither a digitized copy nor a reconstructed voucher is proof.
  const hasProof = (id: string) => docs.some(d =>
    d.linkedRecordType === "Expense" && d.linkedRecordId === id
    && !/^Digitized/i.test(d.category || "") && !/^Reconstructed Voucher/i.test(d.category || ""));

  const gaps = expenses
    .filter(e => COUNTED.includes(e.status) && !hasProof(e.id))
    .sort((a, b) => b.convertedAmount - a.convertedAmount);

  const rows = gaps.map(e => {
    const r = route(`${e.title || ""} ${e.purpose || ""}`);
    // Cash leaves no bank trail; on a closed grant there is also no live relationship to chase.
    const cash = e.paymentMethod === "Cash";
    const shut = closed.get(e.projectId) === true;
    return {
      voucher: e.voucherNo,
      date: String(e.created_at).slice(0, 10),
      project: codeOf.get(e.projectId) || "—",
      amount: e.convertedAmount,
      method: e.paymentMethod || "",
      title: (e.title || "").replace(/[\n\r,]/g, " ").slice(0, 60),
      route: r.key,
      routeLabel: r.label,
      how: r.how,
      difficulty: r.key === "email" ? 1 : r.key === "provider" ? 2 : cash && shut ? 4 : 3
    };
  });

  const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const group = <T,>(arr: T[], key: (t: T) => string) =>
    arr.reduce((m, x) => { (m[key(x)] ||= []).push(x); return m; }, {} as Record<string, T[]>);

  console.log(`\nEVIDENCE BACKLOG — ${rows.length} posted vouchers with no supporting document`);
  console.log(`total value $${money(rows.reduce((s, r) => s + r.amount, 0))}\n`);

  console.log("BY RECOVERY ROUTE");
  const byRoute = group(rows, r => r.routeLabel);
  for (const [label, rs] of Object.entries(byRoute).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${label.padEnd(20)} ${String(rs.length).padStart(3)}  $${money(rs.reduce((s, r) => s + r.amount, 0)).padStart(11)}`);
    console.log(`  ${" ".repeat(20)}     ${rs[0].how}`);
  }

  console.log("\nBY PROJECT");
  for (const [code, rs] of Object.entries(group(rows, r => r.project)).sort((a, b) => b[1].length - a[1].length)) {
    const cash = rs.filter(r => r.method === "Cash").length;
    console.log(`  ${code.padEnd(22)} ${String(rs.length).padStart(3)}  $${money(rs.reduce((s, r) => s + r.amount, 0)).padStart(11)}   cash ${cash}`);
  }

  console.log("\nSTART HERE — cheapest to recover, highest value first");
  for (const r of rows.filter(r => r.difficulty <= 2).sort((a, b) => a.difficulty - b.difficulty || b.amount - a.amount).slice(0, 15)) {
    console.log(`  ${r.voucher.padEnd(15)} ${r.date}  $${money(r.amount).padStart(9)}  ${r.routeLabel.padEnd(15)} ${r.title}`);
  }

  const hardest = rows.filter(r => r.difficulty === 4);
  console.log(`\nHARDEST — cash on a closed grant: ${hardest.length} vouchers, $${money(hardest.reduce((s, r) => s + r.amount, 0))}`);
  console.log("  No bank trail and no live funder relationship. Expect some of these to be written off");
  console.log("  rather than recovered — but that is a decision to record, not a gap to leave open.");

  if (writeCsv) {
    const out = path.join(VAULT, "GENERAL", "Evidence_Backlog_Worklist.csv");
    const head = "voucher,date,project,amount_usd,method,route,how,title\n";
    const body = rows
      .sort((a, b) => a.difficulty - b.difficulty || b.amount - a.amount)
      .map(r => [r.voucher, r.date, r.project, r.amount.toFixed(2), r.method, r.routeLabel, `"${r.how}"`, `"${r.title}"`].join(","))
      .join("\n");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, head + body);
    console.log(`\nworklist written: ${out}`);
  }

  await prisma.$disconnect();
}

main();
