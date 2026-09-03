-- Physical petty-cash count. Turns "cash on hand" from an inferred book figure into a
-- counted fact, and makes the undocumented gap measurable (book 1120 − counted).
CREATE TABLE "CashCount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "countedUSD" REAL NOT NULL,
    "countedBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);
