// Can every real spelling of a person's address find their account, and no one else's?
//
// Gmail ignores dots and +tags, so one mailbox has many spellings and Google's token
// reports whichever the person registered. This pins the rule that matches them, and
// pins that it applies to Gmail only. Run: npx tsx scripts/check-signin.ts
import { readFileSync } from "node:fs";
import { canonEmail } from "../src/email.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

console.log("\nGmail's own rules");
ok("dots in the local part mean nothing", canonEmail("anahon.leb@gmail.com") === canonEmail("anahonleb@gmail.com"));
ok("a +tag is not a different person", canonEmail("ahmad+fms@gmail.com") === canonEmail("ahmad@gmail.com"));
ok("case is not a different person", canonEmail("AnaHonLeb@Gmail.com") === "anahonleb@gmail.com");
ok("googlemail is gmail", canonEmail("anahonleb@googlemail.com") === "anahonleb@gmail.com");

console.log("\nand nowhere else");
ok("dots matter everywhere else", canonEmail("ahmad.ayshan@hotmail.com") === "ahmad.ayshan@hotmail.com");
ok("an org address is left alone", canonEmail("Marwan@AnaHon.org") === "marwan@anahon.org");
ok("two different people never collapse into one", canonEmail("saad@anahon.org") !== canonEmail("marwan@anahon.org"));
ok("a retired .invalid address can never match a real mailbox", canonEmail("retired-interim-approver-2@anahon.invalid") === "retired-interim-approver-2@anahon.invalid");

console.log("\nwhere the rule is used");
ok("the sign-in middleware looks the account up this way", /dbUser = await findUserByEmail\(verified\.email\)/.test(server));
ok("so does /api/auth/sync", /const user = await findUserByEmail\(verified\.email\)/.test(server));
ok("so does the document ticket", /const u = await findUserByEmail\(v\.email\)/.test(server));
ok("creating an account stores the canonical form", /addr = canonEmail\(addr\);/.test(server));
ok("the rule lives in one file only", !/function canonEmail/.test(server) && server.includes('from "./src/email.js"'));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
