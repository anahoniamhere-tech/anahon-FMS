-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "bankInfo" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "declarationSigned" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "engageable" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Vendor" ("active", "bankInfo", "blocked", "category", "contact", "declarationSigned", "id", "name", "taxId") SELECT "active", "bankInfo", "blocked", "category", "contact", "declarationSigned", "id", "name", "taxId" FROM "Vendor";
DROP TABLE "Vendor";
ALTER TABLE "new_Vendor" RENAME TO "Vendor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

