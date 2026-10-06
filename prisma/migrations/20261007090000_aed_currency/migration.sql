-- AED on the rates row (src/currencies.ts). The dirham is pegged at 3.6725 AED = 1 USD, so the
-- stored value is the peg inverted — USD per one AED — and it does not move with the market.
-- Added for quotation 007/2026 (Taifour Al Bustami, Dubai), issued and accepted in dirhams.
ALTER TABLE "FxRates" ADD COLUMN "AED" REAL NOT NULL DEFAULT 0.272294;
