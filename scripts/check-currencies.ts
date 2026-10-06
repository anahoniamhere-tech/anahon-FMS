/**
 * Quoting in a currency other than the dollar (7 Oct 2026, src/currencies.ts). AED is a peg, not a
 * market rate, and a client's accepted total is converted rather than added across currencies.
 */
import assert from "assert";
import fs from "fs";
import { QUOTE_CURRENCIES, PEGGED, PEG_NOTE, AED_IN_USD, usdPerUnit, toUSD, isMixed } from "../src/currencies.js";
import { AR } from "../src/i18n.js";

const rates = { EUR: 1.1406, LBP: 0.000011 };

// A — the currencies a quotation may carry.
assert.deepEqual([...QUOTE_CURRENCIES], ["USD", "EUR", "LBP", "AED"]);
assert.equal(PEGGED.AED, 3.6725, "the UAE peg, as the commercial register uses it");
assert.ok(/3\.6725/.test(PEG_NOTE.AED), "the peg is stated on the screen, not hidden in code");

// B — what a unit is worth.
assert.equal(usdPerUnit("USD", rates), 1);
assert.equal(usdPerUnit("EUR", rates), 1.1406, "EUR comes from the rates row");
assert.equal(usdPerUnit("LBP", rates), 0.000011);
assert.equal(usdPerUnit("AED", rates), AED_IN_USD);
assert.equal(AED_IN_USD, 0.272294, "1 / 3.6725, to six places");
assert.equal(usdPerUnit("AED", { ...rates, AED: 9.99 } as any), AED_IN_USD, "a peg ignores whatever sits in the rates row");
assert.equal(usdPerUnit("aed", rates), AED_IN_USD, "case does not change money");
assert.equal(usdPerUnit("GBP", rates), 1, "an unknown currency is never given an invented rate");
assert.equal(usdPerUnit("EUR", null), 1, "no rates row: 1, not NaN");

// C — the figures this was built for.
assert.equal(toUSD(14850, "AED", rates), 4043.57, "Taifour's 007/2026: AED 14,850");
assert.equal(toUSD(5000, "AED", rates), 1361.47, "the first instalment");
assert.equal(toUSD(400, "USD", rates), 400, "961picks' 008 is in dollars and is not touched");
assert.equal(toUSD(0, "AED", rates), 0);

// D — the mixed-currency warning.
assert.ok(isMixed(["USD", "AED"]));
assert.ok(!isMixed(["USD", "usd"]));
assert.ok(!isMixed([]));

// E — the screen and the record (read, not assumed).
const tab = fs.readFileSync("src/tabs/ProductionTab.tsx", "utf8");
assert.ok(/QUOTE_CURRENCIES\.map\(c => <option/.test(tab), "the quotation form offers the one list");
assert.ok(/toUSD\(q\.amount, q\.currency, state\.fxRates\)/.test(tab), "a client's accepted total is converted, not added raw");
assert.ok(/acceptedMixed \? "≈ " : ""/.test(tab), "a converted total says so");
const mig = fs.readFileSync("prisma/migrations/20261007090000_aed_currency/migration.sql", "utf8");
assert.ok(/ALTER TABLE "FxRates" ADD COLUMN "AED" REAL NOT NULL DEFAULT 0\.272294/.test(mig), "the rates row carries AED");
assert.ok(/pegged/i.test(mig), "the migration says it is a peg");
assert.ok(AR["pegged"] && AR["Converted to USD — this client was quoted in more than one currency."], "Arabic for both new strings");

console.log("check-currencies: all passed");
