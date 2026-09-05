// Telling a client about their quotation, and a contact that we owe them a follow-up.
//
// 6 Sep 2026 (Projects & funding). Three ways this goes wrong quietly. The wrong sentence:
// "we have sent you quotation X for $4,000" to someone who has already paid half of it
// reads as a demand for the whole sum again, so which template is chosen has to follow
// where the money actually is. The wrong figure: the balance must be what is still owed,
// not the quote — the same tranche arithmetic the screen shows. And the wrong silence: a
// disabled button that explains nothing is a bug report waiting to happen, so the reason
// goes in the label, where a phone can read it, not in a tooltip nobody hovers.
// Run: npx tsx scripts/check-client-whatsapp.ts
import { readFileSync } from "node:fs";
import { waLink, WA_TEMPLATES } from "../src/tabs/shared.js";
import { paidOn, outstandingOn } from "../src/quoteTranches.js";
import { tr } from "../src/i18n.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const production = read("src/tabs/ProductionTab.tsx");
const network = read("src/tabs/NetworkTab.tsx");
const t = (s: string) => s;

console.log("\nA. nothing is sent by the system");
ok("no client message goes through a send route — the only thing built is a wa.me link",
  !/fetch\("\/api\/(whatsapp|messages|send)/.test(production + network));
ok("the quotation button is a link the person presses", /href=\{link\} target="_blank"/.test(production));
ok("so is the contact one", /href=\{link\} target="_blank"/.test(network));

console.log("\nB. the sentence follows the money");
ok("part-paid or invoiced asks about the balance",
  /paidSoFar > 0 \|\| q\.status === "Invoiced"\s*\?\s*WA_TEMPLATES\["client-balance"\]/.test(production));
ok("an offer still out quotes the quotation", /:\s*WA_TEMPLATES\["client-quotation"\]/.test(production));
ok("the balance sent is what is still owed, not the quote",
  /amount: money\(stillOwed\)/.test(production) && /const stillOwed = outstandingOn\(q\.amount, paidSoFar\)/.test(production));
// The arithmetic itself, on the case that started this: a 4,000 job paid 50/50.
const txs = [{ id: "btx-1", amount: 2000 }];
const owed = outstandingOn(4000, paidOn(["btx-1"], txs));
ok("a half-paid 4,000 job is chased for 2,000, not 4,000", owed === 2000);
const balance = WA_TEMPLATES["client-balance"](t, { name: "Zahle", amount: `${owed.toFixed(2)} USD`, date: "2026-08-01" });
ok("and that is the figure in the message", balance.includes("2,000.00 USD".replace(",", "")) || balance.includes("2000.00 USD"), balance);
ok("the message signs itself", balance.trim().endsWith("— AnaHon"));
ok("the Arabic is Arabic, not the English falling through",
  /[؀-ۿ]/.test(WA_TEMPLATES["client-balance"]((s: string) => tr("ar", s), { name: "زحلة", amount: "2000.00 USD", date: "2026-08-01" })));
ok("the client's first name reaches the reader, so the sender knows who they are about to message",
  /const first = \(client\?\.name \|\| ""\)\.split/.test(production) && /\{t\("Message the client"\)\} — \{first\}/.test(production));

console.log("\nC. when each button appears");
ok("a quotation offers it only once it has gone out — sent, accepted or invoiced",
  /\["Sent", "Accepted", "Invoiced"\]\.includes\(q\.status\) && \(\(\) => \{/.test(production));
ok("nothing is offered on a draft, a rejection, an expiry or a settled job",
  !/\["Draft"|"Rejected", "Expired"\]\.includes\(q\.status\) && \(\(\) => \{/.test(production));
ok("a contact is offered it only when the follow-up is actually due",
  /const dueSoon = contacts\.filter\(c => c\.followUpBy && c\.followUpBy <= today && c\.status !== "Dormant"\)/.test(network)
  && /dueSoon\.map\(c => \{/.test(network));
ok("no role list of its own on either — the screen already decides who sees the record",
  !/currentUser\.role/.test((production.split('{t("Message the client")}')[0] || "").slice(-1200))
  && !/currentUser\.role/.test((network.split('{t("Message")}')[0] || "").slice(-900)));

console.log("\nD. the numbers come from the record, and a missing one says so");
ok("a quotation dials the client's own number, and offers nothing when the client row is gone",
  /const link = client \? waLink\(client\.phone \|\| "", text\) : null/.test(production));
ok("a contact dials the contact's own number", /waLink\(c\.phone \|\| "", ""\)/.test(network));
ok("no number, no link", waLink("", "anything") === null);
ok("a national number is refused rather than guessed at", waLink("03 137 217", "x") === null);
ok("the one real number in the live data still dials", waLink("+961 76 137 217", "x") === "https://wa.me/96176137217?text=x");
for (const [file, src] of [["ProductionTab", production], ["NetworkTab", network]] as const) {
  const disabled = (src.match(/<button type="button" disabled[\s\S]{0,600}?<\/button>/g) || []).join("\n");
  ok(`${file}: the reason is in the label, where a phone can read it`,
    disabled.includes('{t("no WhatsApp number on file")}'));
  ok(`${file}: and not hidden in a tooltip`, !/<button type="button" disabled[\s\S]{0,300}title=/.test(disabled));
  ok(`${file}: the dead button cannot be pressed`, /disabled\s/.test(disabled) && /cursor-not-allowed/.test(disabled));
  ok(`${file}: it is a 44px target on a phone`, /min-h-\[44px\]/.test(disabled));
}

console.log("\nE. the contact message is not written for them");
ok("no invented sentence goes to a networking contact — the link opens an empty chat",
  /waLink\(c\.phone \|\| "", ""\)/.test(network));
ok("and the internal follow-up note is never the message",
  !/waLink\(c\.phone[^)]*c\.followUp/.test(network));

console.log("\nF. both labels are translated");
for (const key of ["Message the client", "Message", "no WhatsApp number on file", "Opens WhatsApp — you write it and press Send."]) {
  ok(`"${key}" has Arabic`, /[؀-ۿ]/.test(tr("ar", key)), tr("ar", key));
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
