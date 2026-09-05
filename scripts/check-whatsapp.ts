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
  "client-quotation": { name: "Zahle Municipality", ref: "Q-2026-018", amount: "$4,000.00" },
  "client-balance": { name: "Zahle Municipality", amount: "$1,500.00", date: "2026-08-01" },
  "freelancer-nudge": { name: "Omar", what: "timesheet", period: "August 2026" },
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

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
