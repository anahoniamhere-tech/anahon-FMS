// Does a wa.me link go to the right person, and does the Arabic survive?
//
// 5 Sep 2026. The link is pressed by a human, but the number is chosen by this code: a
// wrong normalisation opens a chat with a stranger and the sender may well press Send
// before reading the name. So the rule is that a number which cannot be dialled
// internationally returns null and the caller hides the button — never a guessed
// country. Run: npx tsx scripts/check-whatsapp.ts
import { waLink, WA_TEMPLATES, type WaTemplateKey } from "../src/tabs/shared.js";
import { tr } from "../src/i18n.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};

console.log("\nA. the number");
ok("a stored international number works — the one real number in the data",
  waLink("+961 76 137 217", "hi") === "https://wa.me/96176137217?text=hi");
ok("00 is a + by another name", waLink("0096176137217", "hi") === "https://wa.me/96176137217?text=hi");
ok("punctuation and spaces are dropped", waLink("+961-76-137-217", "hi")?.includes("/96176137217") === true);
// The whole point: guessing a country is how you message a stranger.
ok("a national number with a trunk 0 is refused, not guessed", waLink("03 137 217", "hi") === null);
ok("something too short to dial is refused", waLink("1234", "hi") === null);
ok("empty is refused", waLink("", "hi") === null && waLink("   ", "hi") === null);
ok("no + is fine when the number is already international length", waLink("96176137217", "hi")?.includes("/96176137217") === true);

console.log("\nB. the text");
const link = waLink("+96176137217", "hello & goodbye + more");
ok("the message is encoded, so & and + survive", link?.endsWith("?text=hello%20%26%20goodbye%20%2B%20more") === true, String(link));

console.log("\nC. the four messages, both languages");
const params: Record<WaTemplateKey, any> = {
  "supplier-paid": { name: "Beirut Print House", voucherNo: "ANH-PV-00412", amount: "$1,250.00", date: "2026-09-02" },
  "client-quotation": { name: "Zahle Municipality", ref: "Q-2026-018", amount: "$4,000.00", validUntil: "2026-09-30", issuedAs: "anahon" },
  "client-balance": { name: "Zahle Municipality", amount: "$1,500.00", date: "2026-08-01", issuedAs: "anahon" },
  "freelancer-nudge": { name: "Omar", what: "timesheet", period: "August 2026" },
  "contact-followup": { name: "Jihane" },
};
for (const key of Object.keys(WA_TEMPLATES) as WaTemplateKey[]) {
  for (const lang of ["en", "ar"]) {
    const text = WA_TEMPLATES[key]((s: string) => tr(lang, s), params[key]);
    ok(`${key} (${lang}): every value is filled in`, !/\{\w+\}/.test(text), text);
    ok(`${key} (${lang}): it says who wrote it`, /— (AnaHon|أنا هون)$/.test(text.trim()), text.slice(-20));
    if (lang === "ar") ok(`${key} (ar): it is actually Arabic, not the English fallback`, /[؀-ۿ]/.test(text));
  }
  ok(`${key}: the name reaches the reader`, WA_TEMPLATES[key]((s: string) => s, params[key]).includes(params[key].name));
}

console.log("\nD. the follow-up opener is safe to send unread");
// It goes to anyone on the Follow-up owed list, and the sender may press Send without
// reading it. Two things would break that: the internal `followUp` note ("propose AnaHon
// as trainer") is about the person, not for them; and any second placeholder — `metAt` is
// optional, so "we met at {where}" renders "we met at  and said…" wherever it is empty.
for (const lang of ["en", "ar"]) {
  const text = WA_TEMPLATES["contact-followup"]((s: string) => tr(lang, s), { name: "Jihane" });
  ok(`contact-followup (${lang}): the name is the only thing filled in`,
    (text.match(/Jihane/g) || []).length === 1 && !/\{\w+\}/.test(text), text);
  ok(`contact-followup (${lang}): it says nothing a stranger could not read`,
    !/followUp|trainer|met at|propose/i.test(text), text);
}
// A sixth parameter appearing here later is the regression this guards against.
ok("it takes the name and nothing else",
  WA_TEMPLATES["contact-followup"]((s: string) => s, { name: "X" }) ===
  "Hello X, following up on our conversation as we agreed. Would you have a few minutes this week? — AnaHon");

console.log("\nE. a client message is signed by whoever issued the quotation (16 Sep 2026)");
// Saad's rule: nothing a client of iContent Studio reads mentions AnaHon. 006/2026 went out
// signed "— AnaHon" and saying "we have sent you" at the moment it was being sent.
const Q = (lang: string, over: any) => WA_TEMPLATES["client-quotation"]((s: string) => tr(lang, s),
  { name: "Maroun", ref: "006/2026", amount: "750.00 USD", validUntil: "2026-09-30", issuedAs: "icontent", ...over });
const BAL = (lang: string, over: any) => WA_TEMPLATES["client-balance"]((s: string) => tr(lang, s),
  { name: "Maroun", amount: "250.00 USD", date: "2026-09-10", issuedAs: "icontent", ...over });
for (const lang of ["en", "ar"]) {
  for (const [label, text] of [["quotation", Q(lang, {})], ["balance", BAL(lang, {})]] as const) {
    ok(`iContent ${label} (${lang}) never names AnaHon`, !/AnaHon|أنا هون/i.test(text), text);
    ok(`iContent ${label} (${lang}) is signed iContent Studio`, /— \u2068?iContent Studio\u2069?$/.test(text.trim()), text.slice(-24));
  }
  ok(`AnaHon quotation (${lang}) is still signed AnaHon`, /— (AnaHon|أنا هون)$/.test(Q(lang, { issuedAs: "anahon" }).trim()));
  ok(`quotation (${lang}) delivers it rather than claiming it was sent`, !/we have sent|أرسلنا/.test(Q(lang, {})), Q(lang, {}));
  ok(`quotation (${lang}) prints the validity date as the PDF does`,
    lang === "en" ? Q(lang, {}).includes("valid until 30 September 2026.") : /30\u2069? أيلول \u2066?2026/.test(Q(lang, {})) && !Q(lang, {}).includes("2026-09-30"), Q(lang, {}));
  const noDate = Q(lang, { validUntil: "" });
  ok(`quotation (${lang}) with no validity date drops the clause`, !/valid until|صالح حتى|\{validUntil\}/.test(noDate) && !/,\s*\./.test(noDate), noDate);
}
ok("a date the code cannot read is shown as written, not guessed", Q("en", { validUntil: "end of month" }).includes("valid until end of month."));
ok("the English quotation reads as agreed",
  Q("en", {}) === "Hello Maroun, here is quotation 006/2026 for 750.00 USD, valid until 30 September 2026. Tell me if anything should change. — iContent Studio", Q("en", {}));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
