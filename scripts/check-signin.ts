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

// 10 Oct 2026: only a Google sign-in with a verified address is an identity here. Tokens are
// signed with a throwaway key and fed to the real verifyIdToken, so this exercises the code
// path every caller goes through (the POST gate, the GET gate, /api/auth/sync), not its text.
console.log("\nwhich sign-ins count");
{
  const { generateKeyPairSync, createSign } = await import("node:crypto");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const home = mkdtempSync(join(tmpdir(), "check-signin-"));
  process.env.HOME = home;                                   // the cert cache is read from $HOME
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  writeFileSync(join(home, ".anahon-fms-google-certs.json"),
    JSON.stringify({ at: Date.now(), certs: { test: publicKey.export({ type: "spki", format: "pem" }) } }));
  const { verifyIdToken } = await import("../src/firebaseAuth.js");
  const project = process.env.FIREBASE_PROJECT_ID || "anahon-financial";
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = (claims: any) => {
    const now = Math.floor(Date.now() / 1000);
    const body = `${b64({ alg: "RS256", kid: "test" })}.${b64({ aud: project, iss: `https://securetoken.google.com/${project}`,
      sub: "u1", iat: now, exp: now + 600, email: "someone@gmail.com", ...claims })}`;
    return `${body}.${createSign("RSA-SHA256").update(body).sign(privateKey).toString("base64url")}`;
  };
  const accepts = async (claims: any) => { try { await verifyIdToken(token(claims)); return true; } catch { return false; } };
  const google = { email_verified: true, firebase: { sign_in_provider: "google.com" } };
  ok("a verified Google sign-in is accepted (the probe can say yes)", await accepts(google));
  ok("an email/password sign-in is refused", !(await accepts({ ...google, firebase: { sign_in_provider: "password" } })));
  ok("an unverified address is refused", !(await accepts({ ...google, email_verified: false })));
  ok("a token that names no provider is refused", !(await accepts({ email_verified: true })));
  ok("an anonymous sign-in is refused", !(await accepts({ ...google, firebase: { sign_in_provider: "anonymous" } })));
}

console.log("\nthe login screen");
{
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  ok("offers no way to create an account", !/createUserWithEmailAndPassword|Create account/.test(app));
  ok("still offers Google sign-in", /signInWithPopup\(auth, new GoogleAuthProvider\(\)\)/.test(app));
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
