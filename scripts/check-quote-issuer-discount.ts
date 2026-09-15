/**
 * Quotation letterhead choice and discount (15 Sep 2026). amount is the net total; a total never
 * goes negative; iContent quotations carry the approved look with fonts embedded, never fetched.
 */
import assert from "assert";
import fs from "fs";
import { quoteTotals, discountBlocker, QUOTE_ISSUERS, DEFAULT_NEW_QUOTE_ISSUER } from "../src/quoteTotals.js";
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
assert.equal((server.match(/issuedAs: quote\.issuedAs, discountAmount: quote\.discountAmount, discountLabel: quote\.discountLabel, title: quote\.title/g) || []).length, 2, "both quotation renderers pass the issuer, the discount and the title");

// C — the PDF.
const base = { quoteNo: "006/2026", date: "2026-09-15", validUntil: "2026-09-30", preparedBy: "Saad Matar", clientName: "Maroun Asmar", clientContact: "", clientPhone: "+961 78 988 693", clientTaxId: "", currency: "USD",
  items: lines.map((l, i) => ({ service: `S${i}`, description: "", output: "", ...l })), terms: {}, notes: "" };
const ic = quotationHtml({ ...base, total: 750, issuedAs: "icontent", discountAmount: 400, discountLabel: "Launch discount", title: "VxV 3030 — Brand Identity & Sales Brochure" });
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
assert.equal((pkg.match(/\$1,150\.00/g) || []).length, 1, "on an iContent quotation only the package value prints 1,150 — no per-line price");
assert.ok(/TOTAL<\/strong><\/td><td class="r amt">\$750\.00/.test(pkg), "a single package line takes the discount too");
assert.deepEqual(quoteTotals([{ unitPrice: 1150, qty: 1 }], 400), { packageValue: 1150, discount: 400, total: 750 });
const srv = fs.readFileSync("server.ts", "utf8");
assert.ok(/omitReference: quote\.issuedAs === "icontent"/.test(srv), "the archived iContent document carries no reference line");
// Package layout (Saad, 15 Sep 2026): three columns, caption = title, no numbering, no per-line prices.
assert.ok(ic.includes("<caption>VxV 3030 — Brand Identity &amp; Sales Brochure</caption>"), "the caption is the quotation title");
assert.ok(/<th[^>]*>Service<\/th><th>What's included<\/th><th[^>]*>You receive<\/th><\/tr><\/thead>/.test(ic), "Service / What's included / You receive");
assert.ok(!/<th>#<\/th>|>Unit<|>Qty<|>Amount<|>When</.test(ic), "no #, Unit, Qty, Amount or When column");
for (const p of ["$250.00", "$350.00", "$150.00"]) assert.ok(!ic.includes(p), `no per-line price ${p} on the client's paper`);
assert.equal((ic.match(/\$400\.00/g) || []).length, 1, "400 prints once — as the discount, not as the logo line's price");
assert.ok(/colspan="2" class="r">Package value<\/td><td class="r">\$1,150\.00/.test(ic), "package value spans the three-column table");
const anPkg = quotationHtml({ ...base, total: 1150 });
assert.ok(anPkg.includes("<th>#</th><th>Service</th><th>Output</th>") && anPkg.includes("$400.00"), "the AnaHon table keeps its columns and line prices");
assert.ok(fs.readFileSync("src/constants.ts", "utf8").includes('ICONTENT_PHONE = "+961 3 677 246"'), "the iContent phone");
assert.ok(ic.includes("contact: Saad Matar · +961 3 677 246 · hello@icontent.studio") && ic.includes("Tripoli, Lebanon · +961 3 677 246 · hello@icontent.studio"), "header and footer carry the iContent phone and email");
assert.ok(!quotationHtml({ ...base, total: 1150 }).includes("icontent.studio"), "the iContent email never appears in AnaHon mode");
assert.ok(!ic.includes("81 408 171"), "the AnaHon number is not on iContent paper");
assert.ok(/\$\{quote\.issuedAs === "icontent" \? "iContent" : "AnaHon"\}_Quotation_/.test(srv), "the downloaded PDF is named for the issuer");
const an = quotationHtml({ ...base, total: 1150 });
assert.ok(an.includes('alt="AnaHon"') && an.includes("For ANAHON PRODUCTION — date &amp; signature"), "default stays today's AnaHon layout");
assert.ok(!an.includes("Package value"), "no discount rows when there is no discount");
assert.ok(!/@font-face/.test(an), "the AnaHon quotation does not carry the iContent fonts");

// D — the form: the reason is in the save button, not a tooltip.
const tab = fs.readFileSync("src/tabs/ProductionTab.tsx", "utf8");
assert.ok(tab.includes('disabled={!!discountProblem}') && tab.includes('t("Cannot save — fix the discount")'), "save refuses a bad discount, saying so");
assert.ok(tab.includes('id="qt-issuer"'), "Issued as is chosen per quotation");
// Saad, 15 Sep 2026: a NEW quotation defaults to iContent Studio; AnaHon stays selectable; saved ones keep theirs.
assert.equal(DEFAULT_NEW_QUOTE_ISSUER, "icontent", "new quotations default to iContent Studio");
assert.ok(/status: "Draft",\s*issuedAs: DEFAULT_NEW_QUOTE_ISSUER,/.test(tab), "the New Quotation form uses that default");
assert.ok(QUOTE_ISSUERS.includes("anahon"), "AnaHon Production stays selectable");
assert.ok(/issuedAs: issuedAs === undefined \? \(prior\?\.issuedAs \|\| "anahon"\) : issuedAs/.test(server), "a saved quotation keeps its issuer — no backfill");

console.log("✓ check-quote-issuer-discount: net amount, never negative, iContent letterhead with embedded fonts, default unchanged");
