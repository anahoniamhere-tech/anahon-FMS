/**
 * Three quotation papers (Saad, 12 Oct 2026): iContent Media (creators' academy, icontent.media),
 * iContent Studio (production, icontent.studio), AnaHon (journalism trainings, services, collaborations).
 * One NNN/YYYY series, 15-day validity, a revision clause per issuer, no bank block.
 * Run: npx tsx scripts/check-quote-issuers.ts
 */
import assert from "assert";
import fs from "fs";
import { quotationHtml, cashReceiptHtml } from "../docgen.js";
import { QUOTE_ISSUERS, QUOTE_ISSUER_LABELS, DEFAULT_NEW_QUOTE_ISSUER, isIContent } from "../src/quoteTotals.js";
import { QUOTE_VALIDITY_DAYS, ICONTENT_MEDIA_EMAIL, QUOTE_REVISION_CLAUSE_ICONTENT_MEDIA, QUOTE_REVISION_CLAUSE_ICONTENT_MEDIA_AR } from "../src/constants.js";

const base = { quoteNo: "009/2026", date: "2026-10-12", validUntil: "2026-10-27", preparedBy: "Saad Matar — Executive Director",
  clientName: "C", clientContact: "", clientPhone: "", clientTaxId: "", currency: "USD", total: 1200, title: "Workshop",
  items: [{ service: "Training", description: "Two days", output: "12 trained", unitPrice: 600, qty: 2 }], terms: {}, notes: "" };
const page = (issuedAs: string) => quotationHtml({ ...base, issuedAs } as any);
const text = (h: string) => h.replace(/data:[a-z+/0-9-]+;base64,[A-Za-z0-9+/=]+/g, "");

// A — the three, and which two are iContent.
assert.deepEqual([...QUOTE_ISSUERS], ["icontent-media", "icontent-studio", "anahon"]);
assert.equal(DEFAULT_NEW_QUOTE_ISSUER, "icontent-studio");
assert.ok(isIContent("icontent-media") && isIContent("icontent-studio") && !isIContent("anahon") && !isIContent("icontent"));
assert.ok(QUOTE_ISSUERS.every(i => QUOTE_ISSUER_LABELS[i]), "every issuer has a label");

// B — iContent Media: the hub's mark, palette and font, all embedded; no AnaHon, no Studio, no email yet.
const m = page("icontent-media"), mt = text(m);
assert.ok(/<img class="mk" src="data:image\/svg\+xml;base64,/.test(m), "the original #أنا المحتوى mark, embedded");
assert.ok(/@font-face\{font-family:"IBM Plex Sans Arabic"[^}]*data:font\/woff2;base64,/.test(m), "IBM Plex Sans Arabic embedded");
assert.ok(m.includes("#a12736") && m.includes("#f7f4ee"), "the hub palette");
assert.ok(!/fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"]*\.(svg|woff2)/.test(m), "nothing fetched at render time");
assert.ok(!/anahon|اناهون|أنا هون|ANH-|Studio|icontent\.studio|Sora/i.test(mt), `Media paper names AnaHon or Studio: ${(mt.match(/.{30}(anahon|اناهون|ANH-|Studio|icontent\.studio).{30}/i) || [""])[0]}`);
assert.ok(mt.includes("+961 70 530 424 (WhatsApp) · icontent.media"), "phone/WhatsApp and the site");
assert.equal(ICONTENT_MEDIA_EMAIL, "", "no mailbox until Admin confirms hello@icontent.media");
assert.ok(!/@icontent\.media/.test(mt), "no email printed");
assert.ok(mt.includes(QUOTE_REVISION_CLAUSE_ICONTENT_MEDIA) && mt.includes(QUOTE_REVISION_CLAUSE_ICONTENT_MEDIA_AR), "its own revision clause, EN + AR");
assert.ok(mt.includes("For iContent — أنا المحتوى — date &amp; signature"));
assert.ok(/<th[^>]*>Service<\/th><th>What's included<\/th>/.test(m) && !/>Unit<|>Qty</.test(m), "the package table, no line prices");

// C — iContent Studio: today's paper, the official number.
const s = text(page("icontent-studio"));
assert.ok(s.includes('<span class="i">i</span>Content<small>STUDIO') && s.includes("+961 70 530 424 · hello@icontent.studio"));
assert.ok(!/anahon|اناهون|ANH-|icontent\.media|أنا المحتوى/i.test(s), "Studio paper names neither AnaHon nor Media");

// D — AnaHon: the letterhead, one heading, the platform's name.
const a = page("anahon");
assert.ok(a.includes('alt="AnaHon"') && a.includes("For ANAHON MEDIA PLATFORM — date &amp; signature") && a.includes("AnaHon Media Platform · This quotation"));
assert.ok(!/ANAHON PRODUCTION|ANAHON production|icontent/i.test(a), "no production-only heading, no iContent");
assert.ok(a.includes("+961 81 408 171") && a.includes(">Unit<"), "AnaHon's number and the itemised table");
// finance@anahon.org on every AnaHon paper (Saad, 12 Oct 2026): header and footer of the quotation, and the receipt.
assert.equal((a.match(/finance@anahon\.org/g) || []).length, 2, "quotation header and footer");
const rc = cashReceiptHtml({ receiptNo: "RC-001/2026", date: "2026-10-12", method: "Cash", clientName: "C", clientContact: "", currency: "USD", amount: 1, amountWords: "one", againstQuoteNo: "005/2026", againstTitle: "T", receivedBy: "Saad Matar" });
assert.ok(rc.includes("finance@anahon.org"), "the cash receipt");
// The receipt names the platform like the quotation, and does not repeat a payer who is their own contact (Saad, 12 Oct 2026).
assert.ok(!/ANAHON PRODUCTION|ANAHON production/.test(rc) && rc.includes("for ANAHON MEDIA PLATFORM — date") && /issued by\s+AnaHon Media Platform/.test(rc), "the receipt signs as the platform");
const same = cashReceiptHtml({ receiptNo: "RC-002/2026", date: "2026-10-12", method: "Cash", clientName: "Mohamad Al Omar", clientContact: "Mohamad Al Omar · +961 78 804 167", currency: "USD", amount: 400, amountWords: "four hundred USD", againstQuoteNo: "005/2026", againstTitle: "T", receivedBy: "Saad Matar" });
assert.ok(same.includes("<td>Mohamad Al Omar — +961 78 804 167</td>"), "a payer who is their own contact is named once, then the phone");
const org = cashReceiptHtml({ receiptNo: "RC-003/2026", date: "2026-10-12", method: "Cash", clientName: "WARD Organization", clientContact: "Rania · +961 70 000 000", currency: "USD", amount: 1, amountWords: "one", againstQuoteNo: "004/2026", againstTitle: "T", receivedBy: "Saad Matar" });
assert.ok(org.includes("<td>WARD Organization — Rania · +961 70 000 000</td>"), "an organisation's named contact still prints");
const docgen = fs.readFileSync("docgen.ts", "utf8");
assert.ok(!docgen.includes("info@anahon.org") && (docgen.match(/\$\{ANAHON_EMAIL\}/g) || []).length === 6, "all six AnaHon addresses come from the one constant");
for (const h of [mt, s]) assert.ok(!/@anahon\.org/.test(h), "no AnaHon address on iContent paper");

// E — what stays shared: one series, one validity, no bank block on any paper.
assert.equal(QUOTE_VALIDITY_DAYS, 15);
for (const h of [m, s, a]) assert.ok(!/IBAN|SWIFT|Account (no|number)|Bank:/i.test(text(h)), "no bank block — payment stays in the Financial notes");
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(/quoteNo: \{ endsWith: `\/\$\{year\}` \}/.test(server), "one NNN/YYYY series across all issuers");
const mig = fs.readFileSync("prisma/migrations/20261012100000_quote_issuers_three/migration.sql", "utf8");
assert.ok(/UPDATE "Quotation" SET "issuedAs" = 'icontent-studio' WHERE "issuedAs" = 'icontent';/.test(mig), "006–008 move to Studio, nothing else");

console.log("check-quote-issuers: all passed");
