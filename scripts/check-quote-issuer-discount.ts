/**
 * Quotation letterhead choice and discount (15 Sep 2026). amount is the net total; a total never
 * goes negative; iContent quotations carry the approved look with fonts embedded, never fetched.
 */
import assert from "assert";
import fs from "fs";
import { quoteTotals, discountBlocker, QUOTE_ISSUERS } from "../src/quoteTotals.js";
import { quotationHtml } from "../docgen.js";

// A — arithmetic: the VxV 3030 case (006/2026) as it will be entered.
const lines = [400, 250, 350, 150].map(p => ({ unitPrice: p, qty: 1 }));
assert.deepEqual(quoteTotals(lines, 400), { packageValue: 1150, discount: 400, total: 750 });
assert.deepEqual(quoteTotals(lines, 0), { packageValue: 1150, discount: 0, total: 1150 });
assert.equal(discountBlocker(lines, 400), "");
assert.equal(discountBlocker(lines, 1150), "", "a discount equal to the package gives a total of zero, which is allowed");
assert.ok(discountBlocker(lines, 1150.01), "a total can never go below zero");
assert.ok(discountBlocker(lines, -10), "a discount is entered positive");
assert.ok(discountBlocker([], 10), "no discount without lines");
assert.ok(discountBlocker([{ unitPrice: -50, qty: 1 }], 0), "no negative line prices — the discount is the only deduction");
assert.deepEqual([...QUOTE_ISSUERS], ["anahon", "icontent"]);

// B — the server keeps amount the net total and refuses what would go negative.
const server = fs.readFileSync("server.ts", "utf8");
assert.ok(/amount: lineItems\.length \? sums\.total :/.test(server), "amount is the net total");
assert.ok(/const refusedDiscount = discountBlocker\(lineItems, discount\);/.test(server), "the server refuses a bad discount");
assert.equal((server.match(/issuedAs: quote\.issuedAs, discountAmount: quote\.discountAmount, discountLabel: quote\.discountLabel/g) || []).length, 2, "both quotation renderers pass the issuer and the discount");

// C — the PDF.
const base = { quoteNo: "006/2026", date: "2026-09-15", validUntil: "2026-09-30", preparedBy: "Saad Matar", clientName: "Maroun Asmar", clientContact: "", clientPhone: "+961 78 988 693", clientTaxId: "", currency: "USD",
  items: lines.map((l, i) => ({ service: `S${i}`, description: "", output: "", ...l })), terms: {}, notes: "" };
const ic = quotationHtml({ ...base, total: 750, issuedAs: "icontent", discountAmount: 400, discountLabel: "Launch discount" });
assert.ok(ic.includes('<span class="i">i</span>Content<small>STUDIO · BRANDING &amp; CONTENT</small>'), "iContent wordmark");
assert.ok(!ic.includes('alt="AnaHon"'), "no AnaHon logo image on an iContent quotation");
// Saad, 15 Sep 2026: a client document issued as iContent names AnaHon nowhere (fonts stripped first,
// since base64 is arbitrary letters).
const icText = ic.replace(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/g, "");
assert.ok(!/anahon|أنا هون|ANH-/i.test(icText), `an iContent quotation mentions AnaHon: ${(icText.match(/.{30}(anahon|أنا هون|ANH-).{30}/i) || [""])[0]}`);
assert.ok(ic.includes("For iContent Studio — date &amp; signature"), "signature block");
assert.ok(ic.includes("contact: Saad Matar · +961"), "contact footer, no title");
assert.ok(ic.includes("iContent Studio · This quotation is not an invoice"), "footer");
assert.ok(/Package value<\/td><td class="r">\$1,150\.00/.test(ic) && /Launch discount<\/td><td class="r"[^>]*>−\$400\.00/.test(ic) && /TOTAL<\/strong><\/td><td class="r amt">\$750\.00/.test(ic), "Package value, Discount (negative) and TOTAL");
assert.ok(/@font-face\{font-family:"Sora"[^}]*data:font\/woff2;base64,/.test(ic) && /@font-face\{font-family:"Inter"[^}]*data:font\/woff2;base64,/.test(ic), "Sora and Inter embedded");
assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(ic), "never fetched from Google at render time");
assert.ok(ic.includes("iContent Studio may revise the prices"), "the iContent revision clause");
// One package line (006/2026 as Saad wants it): 1,150 on the line, 1,150 package value, −400, 750.
const pkg = quotationHtml({ ...base, items: [{ service: "VxV 3030 package", description: "Logo · guidelines · brochure PDF · brochure HTML", output: "", unitPrice: 1150, qty: 1 }], total: 750, issuedAs: "icontent", discountAmount: 400, discountLabel: "Launch discount" });
assert.equal((pkg.match(/\$1,150\.00/g) || []).length, 3, "the package line (unit and amount) and the package value each print 1,150");
assert.ok(/TOTAL<\/strong><\/td><td class="r amt">\$750\.00/.test(pkg), "a single package line takes the discount too");
assert.deepEqual(quoteTotals([{ unitPrice: 1150, qty: 1 }], 400), { packageValue: 1150, discount: 400, total: 750 });
const srv = fs.readFileSync("server.ts", "utf8");
assert.ok(/plainReference: quote\.issuedAs === "icontent"/.test(srv), "the archived iContent document drops 'issued via AnaHon FMS'");
assert.ok(/\$\{quote\.issuedAs === "icontent" \? "iContent" : "AnaHon"\}_Quotation_/.test(srv), "the downloaded PDF is named for the issuer");
const an = quotationHtml({ ...base, total: 1150 });
assert.ok(an.includes('alt="AnaHon"') && an.includes("For ANAHON PRODUCTION — date &amp; signature"), "default stays today's AnaHon layout");
assert.ok(!an.includes("Package value"), "no discount rows when there is no discount");
assert.ok(!/@font-face/.test(an), "the AnaHon quotation does not carry the iContent fonts");

// D — the form: the reason is in the save button, not a tooltip.
const tab = fs.readFileSync("src/tabs/ProductionTab.tsx", "utf8");
assert.ok(tab.includes('disabled={!!discountProblem}') && tab.includes('t("Cannot save — fix the discount")'), "save refuses a bad discount, saying so");
assert.ok(tab.includes('id="qt-issuer"'), "Issued as is chosen per quotation");

console.log("✓ check-quote-issuer-discount: net amount, never negative, iContent letterhead with embedded fonts, default unchanged");
