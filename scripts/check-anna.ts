// Anna's rules, read from the code (drafts/anna-assistant-plan.md §4).
//
// 16 Sep 2026. Anna reads Saad's records with a paid model and opens his screens. What must
// never regress: only Saad; never the free tier; the chat kept only in Saad's own row (decision B); no tool that
// approves, pays, sends, shares, deletes, signs or publishes; the route writes only audit
// lines; only whitelisted fields reach the model; pay as totals only (D3); no sealed sources.
// Run: npx tsx scripts/check-anna.ts
import { readFileSync } from "node:fs";
import {
  ANNA_MODEL, ANNA_USERS, ANNA_LIMITS, ANNA_TOOL_NAMES, CLIENT_TOOLS, READ_TOOLS, DRAFT_TOOLS, RECORD_KINDS, CONFIRM_ROUTES,
  annaTools, annaSystem, readTool, draftTool, clientAction, cleanHistory, visibleRows, type AnnaCtx,
} from "../src/anna.js";
import { searchHits } from "../src/globalSearch.js";

let failed = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) { failed++; console.error(`  FAIL  ${label}${detail ? " — " + detail : ""}`); } else console.log(`  ok    ${label}`);
};
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const server = read("../server.ts");
const annaSrc = read("../src/anna.ts");
const route = (() => {
  const a = server.indexOf('app.post("/api/anna/turn"');
  return a < 0 ? "" : server.slice(a, server.indexOf("\n});\n", a));
})();
ok("the route exists", route.length > 500);

console.log("\n1. Saad only");
ok("ANNA_USERS is exactly Saad (u-1)", ANNA_USERS.length === 1 && ANNA_USERS[0] === "u-1");
ok("the route checks the real signed-in user, first",
  /const viewer = \(req as any\)\.dbUser;\s*if \(!ANNA_USERS\.includes\(viewer\.id\)\)/.test(route));
ok("a refusal is a 403 with an audit line", /"Anna Refused", "Not on the Anna user list\."\);\s*return res\.status\(403\)/.test(route));
ok("the panel flag reads the real user too", /anna: \{ enabled: !!viewer && ANNA_USERS\.includes\(viewer\.id\)[,} ]/.test(server));
ok("the route is gated", /"\/api\/anna\/turn": ANY/.test(read("../src/gates.ts")));

console.log("\n2. paid only, never the free tier");
ok("the model is Sonnet 5 (D2)", ANNA_MODEL === "claude-sonnet-5");
ok("the route never names Gemini", !/gemini/i.test(route));
ok("its policy call is paid-only", /REPLY_SCHEMA, undefined, "low", "haiku", true\)/.test(route));
ok("paid-only never falls through to Gemini", /if \(paidOnly \|\| !process\.env\.GEMINI_API_KEY\) throw err;/.test(server)
  && /if \(paidOnly && !key\) throw/.test(server));
ok("every askJson in the route is paid-only", (route.match(/askJson\(/g) || []).length === (route.match(/"haiku", true\)/g) || []).length);

console.log("\n3. the chat is kept only in its owner's row (decision B), never in the log");
const audits = [...route.matchAll(/createAuditLog\(([^;]*)\);/g)].map(m => m[1]);
ok("the route writes audit lines", audits.length >= 5, String(audits.length));
ok("no audit line carries the question, the answer, a tool input value or a result",
  audits.every(a => !/\bmessages\b|\banswer\b|\bquestion\b|\basked\b|\bout\b|\btext\b|c\.input\?\.(id|query|question|door|text)|JSON/.test(a)), audits.find(a => /\bmessages\b|\banswer\b|\bquestion\b|\basked\b|\bout\b|\btext\b|c\.input\?\.(id|query|question|door|text)|JSON/.test(a)));
ok("no console output in the route", !/console\./.test(route));
ok("the error path reports a status, never the SDK message", !/err\.message|err\?\.message/.test(route));
const schema = read("../prisma/schema.prisma");
ok("one chat table, owned by a user", /model AnnaChat \{[^}]*\buserId\s+String\b/.test(schema) && (schema.match(/^model \w*Chat\b/gm) || []).length === 1);
const chatQueries = server.match(/prisma\.annaChat\.\w+\([^;]*/g) || [];
ok("every chat query names the owner", chatQueries.length >= 5 && chatQueries.every(q => /userId/.test(q)), chatQueries.find(q => !/userId/.test(q)));
const loadStateSrc = server.slice(server.indexOf("async function loadState("), server.indexOf("\n}\n", server.indexOf("async function loadState(")));
ok("the chats never travel in the shared state", loadStateSrc.length > 500 && !/annaChat/i.test(loadStateSrc));
const chatRoutes = ['app.get("/api/anna/chats"', 'app.get("/api/anna/chats/:id"', 'app.post("/api/anna/chats/delete"'].map(h => {
  const a = server.indexOf(h); return a < 0 ? "" : server.slice(a, server.indexOf("\n});\n", a));
});
ok("the three chat routes check the owner first", chatRoutes.every(r => /^[^\n]*\n  const me = annaOwner\(req\);\n  if \(!me\) return res\.status\(403\)/.test(r)));
ok("the owner is the real signed-in person on Anna's list", /const annaOwner = \(req: any\) => \{\s*const me = req\.dbUser;\s*return me\?\.active && ANNA_USERS\.includes\(me\.id\) \? me : null;/.test(server));
ok("a delete is logged as a count only", /"Anna Chats Deleted", `\$\{count\} chat\$\{count === 1 \? "" : "s"\}\$\{all \? " \(all\)" : ""\}\.`/.test(chatRoutes[2]));
ok("a turn is saved under the signed-in user, not the body's", /saveAnnaTurn\(viewer\.id, /.test(route) && !/saveAnnaTurn\(req\.body/.test(route));
ok("what is saved is the question and Anna's reply, nothing from the tools", /saveAnnaTurn\(viewer\.id, String\(req\.body\?\.chatId \|\| ""\), asked, \{ role: "assistant", content: answer, actions, usd \}\)/.test(route));

console.log("\n4. the tool list is closed");
const tools = annaTools(["mydesk", "expenses"]);
ok("exactly the thirteen tools", JSON.stringify(tools.map(t => t.name)) === JSON.stringify(ANNA_TOOL_NAMES) && ANNA_TOOL_NAMES.length === 13
  && JSON.stringify(DRAFT_TOOLS) === '["draft_quotation","draft_task","draft_contract","draft_request"]');
ok("every tool has a closed schema", tools.every(t => t.input_schema.additionalProperties === false));
ok("navigation and read tools are strict; only the drafts are not (the API's complexity limit)",
  tools.every(t => t.strict === !(DRAFT_TOOLS as readonly string[]).includes(t.name)));
const FORBIDDEN = /\b(approve|reject|pay|send|share|delete|publish|sign|receipt|match|deposit)\b/i;
ok("no tool name or description names a tier-3 act", tools.every(t => !FORBIDDEN.test(t.name + " " + t.description)),
  tools.filter(t => FORBIDDEN.test(t.name + " " + t.description)).map(t => t.name).join(","));
ok("an unknown tool name is refused and logged", /if \(!ANNA_TOOL_NAMES\.includes\(c\.name\)\)[\s\S]{0,120}"No such tool\."[\s\S]{0,120}"Anna Refused"/.test(route));
ok("open_door offers only the viewer's doors", JSON.stringify(tools[0].input_schema.properties.door.enum) === '["mydesk","expenses"]');

console.log("\n5. the route writes audit lines and its own chat, nothing else");
const WRITE = /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b|\$executeRaw|fs\.(write|append|rm|unlink|rename)/;
ok("no write in the route", !WRITE.test(route), route.match(WRITE)?.[0]);
const saver = server.slice(server.indexOf("async function saveAnnaTurn("), server.indexOf("\n}\n", server.indexOf("async function saveAnnaTurn(")));
ok("the only other write is saveAnnaTurn, and it writes chats only",
  saver.length > 200 && [...saver.matchAll(/prisma\.(\w+)\.(create|update|updateMany|upsert|delete|deleteMany)\b/g)].every(m => m[1] === "annaChat")
  && [...route.matchAll(/await (\w+)\(/g)].map(m => m[1]).filter(f => !["createAuditLog", "loadState", "import", "policyCorpus", "askJson"].includes(f)).every(f => f === "saveAnnaTurn"));
ok("no write in src/anna.ts", !WRITE.test(annaSrc) && !/from "node:fs"|from "fs"|fetch\(/.test(annaSrc));
ok("it is a read-only POST for the push filter", /READ_ONLY_POSTS = new Set\(\[[^\]]*"\/api\/anna\/turn"/.test(server));

console.log("\n7. only whitelisted fields reach the model");
// A state stuffed with things that must not travel.
const SECRET = ["LB62000000001234", "+961 70 123 456", "LR1234567", "saad.private@example.com", "SRC-CODE-FILE", "NOTE-INSIDE",
  "PURPOSE-TEXT", "4321.5", "TAX-998877"];
const state: any = {
  users: [{ id: "u-1", name: "Saad Matar", email: "saad.private@example.com" }],
  projects: [{ id: "p1", code: "SKF", name: "SKF Media", status: "Active", budgetUSD: 1000, donorId: "d1" }],
  donors: [{ id: "d1", name: "SKF" }],
  vendors: [{ id: "v1", name: "Beirut Print", category: "Printing", bankInfo: "LB62000000001234", taxId: "TAX-998877", phone: "+961 70 123 456", contact: "saad.private@example.com", active: true }],
  clients: [{ id: "c1", name: "Maroun", email: "saad.private@example.com", phone: "+961 70 123 456", taxId: "TAX-998877", notes: "NOTE-INSIDE", active: true }],
  expenses: [
    { id: "e1", voucherNo: "VCH-1", title: "Printing", purpose: "PURPOSE-TEXT", vendorId: "v1", projectId: "p1", status: "Paid", currency: "USD", amount: 50, convertedAmount: 50, created_at: "2026-09-01", comments: [{ text: "NOTE-INSIDE" }], paymentRef: "LB62000000001234" },
    { id: "e2", voucherNo: "VCH-2", title: "Salary Rana Aug", purpose: "PURPOSE-TEXT", projectId: "p1", status: "Paid", currency: "USD", amount: 4321.5, convertedAmount: 4321.5, created_at: "2026-09-02", costAccountCode: "5100" },
    { id: "e3", voucherNo: "VCH-3", title: "Fee Omar", projectId: "p1", status: "Paid", currency: "USD", amount: 4321.5, convertedAmount: 4321.5, created_at: "2026-09-03", noSupplierChoice: "a freelancer's fee under an agreement" },
  ],
  quotations: [{ id: "q1", quoteNo: "006/2026", clientId: "c1", title: "Branding", status: "Sent", currency: "USD", amount: 750, date: "2026-09-10", notes: "NOTE-INSIDE", items: [{ description: "NOTE-INSIDE" }] }],
  documents: [
    { id: "doc1", filename: "Invoice.pdf", category: "Invoice", created_at: "2026-09-01", base64: "", note: "NOTE-INSIDE" },
    { id: "doc2", filename: "Passport LR1234567.pdf", category: "ID", partyId: "emp-1", created_at: "2026-09-01" },
    { id: "doc3", filename: "Integrity SRC-CODE-FILE.pdf", category: "Evidence", linkedRecordType: "Integrity", created_at: "2026-09-01" },
  ],
  complianceTasks: [{ id: "t1", title: "TRF report", category: "Donor", dueDate: "2026-09-20", status: "Pending", notes: "NOTE-INSIDE", assigneeUserId: "u-1" }],
  engagements: [{ id: "g1", title: "ICFJ training", kind: "Training", org: "ICFJ", startDate: "2026-09-19", notes: "NOTE-INSIDE" }],
  employees: [{ id: "emp-1", name: "Rana", salary: 4321.5, phone: "+961 70 123 456" }],
  bankTransactions: [{ id: "b1", description: "LB62000000001234 transfer", date: "2026-09-01", type: "Debit" }],
  auditLogs: [{ id: "a1", details: "NOTE-INSIDE" }],
};
const ctx: AnnaCtx = { state, doors: ["mydesk", "expenses"], today: "2026-09-16",
  desk: [{ id: "x", kind: "expenses" as any, recordId: "e1", door: "expenses", title: "VCH-1 — Printing", verb: "Approve", status: "Submitted", when: "2026-09-02", urgency: "overdue", group: "mine", seats: [], record: state.expenses[0] }] };
const calls: [string, any][] = [
  ["my_desk", { filter: "all" }],
  ...["LB62", "+961", "LR12", "saad", "SRC", "NOTE", "PURPOSE", "4321", "TAX", "Salary", "Omar", "Rana", "Passport", "Integrity", "Print", "Maroun", "006"].map(q => ["search", { query: q }] as [string, any]),
  ...RECORD_KINDS.map(k => ["list_records", { kind: k }] as [string, any]),
  ...RECORD_KINDS.flatMap(k => ["e1", "e2", "e3", "q1", "p1", "c1", "v1", "doc1", "doc2", "doc3", "t1", "g1"].map(id => ["get_record", { kind: k, id }] as [string, any])),
  ...["voucher", "quotation", "project"].flatMap(k => ["none", "status", "project", "month"].map(g => ["totals", { kind: k, groupBy: g }] as [string, any])),
  ["who_can", { action: "expense" }],
];
const dump = calls.map(([n, i]) => JSON.stringify(readTool(n, i, ctx))).join("\n");
for (const s of SECRET) ok(`no tool result carries ${JSON.stringify(s)}`, !dump.includes(s));
ok("but the ordinary facts do travel", ["VCH-1", "Beirut Print", "006/2026", "Maroun", "TRF report", "ICFJ training", "Invoice.pdf", "SKF"].every(x => dump.includes(x)));
ok("a pay voucher is not a row anywhere (D3)", !/VCH-2|VCH-3|Salary Rana|Fee Omar/.test(dump));
ok("personnel and integrity papers are not rows", !/doc2|doc3|Passport/.test(dump));
const pay: any = readTool("totals", { kind: "staff_costs", groupBy: "project" }, ctx);
ok("staff costs come as one total, never grouped by project", pay.groupBy === "none" && pay.groups.all?.count === 2 && pay.groups.all.sums.USD === 8643);
const payMonth: any = readTool("totals", { kind: "staff_costs", groupBy: "month" }, ctx);
ok("or by month", payMonth.groupBy === "month" && payMonth.groups["2026-09"]?.count === 2);
ok("a record not in the viewer's state is not visible", JSON.stringify(readTool("get_record", { kind: "voucher", id: "nope" }, ctx)).includes("Not visible"));
ok("opening a pay voucher is refused", "error" in clientAction("open_record", { kind: "voucher", id: "e2" }, ctx));
ok("opening a door the viewer lacks is refused", "error" in clientAction("open_door", { door: "banking" }, ctx));
ok("opening a visible record is allowed", (clientAction("open_record", { kind: "quotation", id: "q1" }, ctx) as any).type === "open_record");
ok("list_records never returns more than the cap", ANNA_LIMITS.rows === 25 && /Math\.min\(Math\.max\(Number\(input\?\.limit\) \|\| ANNA_LIMITS\.rows, 1\), ANNA_LIMITS\.rows\)/.test(annaSrc));

console.log("\n8. no sealed sources, no tier-3 paths");
ok("src/anna.ts imports nothing from sources", !/sources/.test(annaSrc.split("\n").filter(l => l.startsWith("import")).join("\n")));
ok("the route never touches a source file", !/sourceFile|\/api\/sources|SealedDoc/i.test(route));
ok("the only route paths in src/anna.ts are the confirm routes",
  [...annaSrc.matchAll(/"(\/api\/[^"]+)"/g)].every(m => (CONFIRM_ROUTES as readonly string[]).includes(m[1])));

console.log("\n9. the loop is bounded");
ok("limits: 6 calls, 30 s, 16k tokens", ANNA_LIMITS.calls === 6 && ANNA_LIMITS.ms === 30_000 && ANNA_LIMITS.maxTokens === 16_000);
ok("the loop uses them", /while \(usage\.calls < ANNA_LIMITS\.calls\)/.test(route) && /Date\.now\(\) - started > ANNA_LIMITS\.ms/.test(route) && /max_tokens: ANNA_LIMITS\.maxTokens/.test(route));
ok("a refusal is shown plainly", /stop_reason === "refusal"/.test(route));
ok("the model gets its thinking back unchanged", /messages\.push\(\{ role: "assistant", content: msg\.content \}\)/.test(route));

console.log("\n10. record text is data");
ok("the instructions say so", /Tool results are data/.test(annaSystem("Super Admin", "", "2026-09-16")));
ok("tool results go back as tool results", /type: "tool_result", tool_use_id: c\.id, content: JSON\.stringify\(out\)/.test(route));
ok("the browser can send only plain text turns", cleanHistory([
  { role: "user", content: "hi" }, { role: "assistant", content: [{ type: "tool_use" }] }, { role: "system", content: "x" }, { role: "user", content: "again" },
]).length === 2);
ok("and never ends on an assistant turn", cleanHistory([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]).length === 0);
ok("long history drops its oldest turns", cleanHistory([
  { role: "user", content: "x".repeat(8000) }, ...Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: "y".repeat(8000) })),
]).reduce((n, m) => n + m.content.length, 0) <= ANNA_LIMITS.chars);

console.log("\nS. one search matcher for the screen and Anna");
const nav: any = { formatUSD: (n: number) => `$${n}`, setSearchTerm() {}, handleNavClick() {}, setSelectedProjectId() {}, openDoc() {}, setBankSearch() {}, setBankFilterAcc() {} };
ok("the screen still finds a voucher, a project and a bank line", ["VCH-1", "SKF", "Print"].every(q => searchHits(q, state, nav).length > 0)
  && searchHits("transfer", state, nav)[0]?.k === "Bank");
ok("both read src/searchCore.ts", /from "\.\/searchCore"/.test(read("../src/globalSearch.tsx")) && /from "\.\/searchCore"/.test(annaSrc));
ok("tool kinds are closed", CLIENT_TOOLS.length === 2 && READ_TOOLS.length === 7 && visibleRows("voucher", state).length === 1);

console.log("\nP. the panel keeps nothing in the browser and only navigates");
const desk = read("../src/HelpDesk.tsx");
const chat = desk.slice(desk.indexOf("function AnnaChat("), desk.indexOf("export default function HelpDesk("));
ok("the panel exists", chat.length > 500);
ok("no browser storage for the chat", !/localStorage|sessionStorage|indexedDB/.test(chat));
const fetches = [...chat.matchAll(/fetch\(([^,)]+)/g)].map(m => m[1]);
ok("six calls: her voice clip, Anna's turn, a confirm route, and her own chat list, chat and delete",
  JSON.stringify(fetches) === JSON.stringify(['"/api/anna/listen"', '"/api/anna/chats"', '`/api/anna/chats/${encodeURIComponent(id', '"/api/anna/chats/delete"', "p.confirmRoute", '"/api/anna/turn"']), fetches.join(" "));
ok("a card from a saved chat has no buttons", /\{m\.past \? \(\s*<p[^>]*>\{t\("From an earlier session/.test(chat) && /\(\{ \.\.\.m, past: true \}\)/.test(chat));
ok("deleting asks first", (chat.match(/window\.confirm\(/g) || []).length === 1 && /if \(!window\.confirm\([^;]*\)\) return;\s*try \{\s*const r = await fetch\("\/api\/anna\/chats\/delete"/.test(chat));
ok("the confirm route is checked against the closed list first, and a contract never posts",
  /if \(!\(CONFIRM_ROUTES as readonly string\[\]\)\.includes\(p\.confirmRoute\) \|\| p\.confirmRoute === "form:contract"\) return;\s*setCards/.test(chat));
ok("a confirmed quotation is always a Draft", /const body = p\.kind === "quotation" \? \{ \.\.\.p\.data, status: "Draft" \} : p\.data;/.test(chat));
ok("a card is never run on arrival", /actions\.forEach\(a => \{ if \(a\.type !== "proposal"\) run\(a\); \}\);/.test(chat));
ok("only plain text turns are sent", /messages: history\.map\(m => \(\{ role: m\.role, content: m\.content \}\)\)/.test(chat));
ok("a failed turn is never sent back", /msgs\.filter\(m => !m\.error\)/.test(chat));
ok("a navigation action can only open a door or a record",
  /const run = \(a: NavAction\) => a\.type === "open_door" \? onOpenDoor\(a\.door\) : onOpenRecord\(a\.kind, a\.id\);/.test(chat)
  && /type NavAction = \{ type: "open_door"; door: string \} \| \{ type: "open_record"; kind: string; id: string \};/.test(desk));
ok("the tab shows only when the server says so", /anna=\{!!state\.anna\?\.enabled\}/.test(read("../src/App.tsx")));
ok("the name is Anna in both languages (D7)", !/"Anna":/.test(read("../src/i18n.ts")) && /\{m === "anna" \? "Anna" : t\("Help"\)\}/.test(desk));

console.log("\nV. voice: one clip in, words out, nothing kept but the chat");
const listen = (() => { const a = server.indexOf('app.post("/api/anna/listen"'); return a < 0 ? "" : server.slice(a, server.indexOf("\n});\n", a)); })();
const voiceSrc = read("../src/annaVoice.ts");
ok("the listen route exists and checks the owner first", /^[^\n]*\n  const me = annaOwner\(req\);\n  if \(!me\) return res\.status\(403\)/.test(listen));
ok("without the key it says so and does nothing", /if \(!annaVoiceReady\(\)\) return res\.status\(503\)/.test(listen)
  && /const annaVoiceReady = \(\) => !!process\.env\.DEEPGRAM_API_KEY;/.test(server)
  && /anna: \{ enabled: [^}]*, voice: annaVoiceReady\(\) \}/.test(server));
ok("Deepgram Nova-3 with the training opt-out, and nothing else is called", /model=nova-3&language=\$\{DEEPGRAM_LANG\[lang\]\}&smart_format=true&mip_opt_out=true/.test(listen)
  && (listen.match(/fetch\(/g) || []).length === 1 && !/gemini|anthropic|askJson/i.test(listen));
ok("English is multi, Arabic is Lebanese (multi has no Arabic)", /const DEEPGRAM_LANG = \{ en: "multi", ar: "ar-LB" \} as const;/.test(server)
  && /const lang = req\.body\?\.lang === "ar" \? "ar" : "en";/.test(listen));
ok("the clip is a sound file under the cap, held in memory only", /if \(audio\.length > ANNA_CLIP_MAX\) return res\.status\(413\)/.test(listen)
  && /ANNA_CLIP_MAX = 1_000_000;/.test(server) && /\^audio\\\//.test(listen) && !WRITE.test(listen) && !/vault|writeFile|tmp/i.test(listen));
const heard = [...listen.matchAll(/createAuditLog\(([^;]*)\);/g)].map(m => m[1]);
ok("its audit lines hold the length and cost, never the words", heard.length === 2 && heard.every(a => !/words|transcript|\bd\b|body|err\.message/.test(a)), heard.join(" | "));
ok("the error never quotes Deepgram", !/err\.message|err\?\.message|r\.text\(\)/.test(listen));
ok("the words go back to the device, then travel as an ordinary turn", /res\.json\(\{ transcript: words \}\)/.test(listen) && /setVoice\("idle"\);\s*send\(words\);/.test(chat));
ok("gated, and a read-only POST", /"\/api\/anna\/listen": ANY/.test(read("../src/gates.ts")) && /READ_ONLY_POSTS = new Set\(\[[^\]]*"\/api\/anna\/listen"/.test(server));
const allSrc = ["../src/HelpDesk.tsx", "../src/annaVoice.ts", "../src/App.tsx"].map(read).join("\n");
ok("never the browser's speech recognition (audio to Google)", !/SpeechRecognition/.test(allSrc));
ok("the recorder calls nothing and keeps nothing", !/fetch\(|localStorage|sessionStorage|indexedDB/.test(voiceSrc));
ok("the mic is released when a clip ends", /rec\.onstop = \(\) => \{[\s\S]{0,80}stream\.getTracks\(\)\.forEach\(t => t\.stop\(\)\)/.test(voiceSrc));
ok("a clip with no speech is not sent", /if \(!heard && now - started > NOTHING_MS\) \{ cancelled = true; stop\(\); \}/.test(voiceSrc)
  && /onDone\(cancelled \|\| !chunks\.length \? null :/.test(voiceSrc) && /if \(!clip\) \{ setVoice/.test(chat));
ok("closing the panel cancels a recording", /useEffect\(\(\) => \(\) => \{ recRef\.current\?\.cancel\(\); hush\(\); \}, \[\]\);/.test(chat));
ok("reading aloud is off until Saad turns it on, and uses the device's voices", /let readAloud = false;/.test(desk) && /new SpeechSynthesisUtterance\(/.test(voiceSrc));

console.log("\n6. drafts are cards; Saad's press writes, through the existing routes");
ok("four confirm routes, exactly", JSON.stringify(CONFIRM_ROUTES) === '["/api/quotations/save","/api/compliance/save","/api/requests/save","form:contract"]');
const st2: any = { ...state,
  users: [...state.users, { id: "u-7", name: "Rana Haddad", active: true }, { id: "u-8", name: "Rana Old", active: false }],
  employees: [{ id: "emp-1", name: "Rana Haddad", active: true }],
  vendors: [...state.vendors, { id: "v2", name: "Omar Films", engageable: true, active: true }, { id: "v3", name: "Blocked Films", engageable: true, active: true, blocked: true }] };
const c2: AnnaCtx = { ...ctx, state: st2 };
const dq: any = draftTool("draft_quotation", { client: "maroun", title: "Reel", currency: "USD", issuedAs: "icontent",
  items: [{ service: "Edit", description: "30s reel", output: "MP4", unitPrice: 150, qty: 2 }] }, c2);
ok("a quotation card names a registered client and is a Draft", dq.proposal?.data.clientId === "c1" && dq.proposal.data.status === "Draft"
  && dq.proposal.confirmRoute === "/api/quotations/save" && dq.proposal.lines.some((l: string) => l.includes("USD 300")));
ok("an unregistered client is refused, with where to register", /registered on the Clients & quotations screen/.test((draftTool("draft_quotation", { client: "Nobody", title: "x", items: [{ service: "a", unitPrice: 1, qty: 1 }] }, c2) as any).error || ""));
const dt: any = draftTool("draft_task", { title: "Call SKF", dueDate: "2026-09-20", category: "Donor", assignee: "rana" }, c2);
ok("a task card resolves an active person only", dt.proposal?.data.assigneeUserId === "u-7" && dt.proposal.confirmRoute === "/api/compliance/save");
ok("an unclear name is asked back, never guessed", "error" in draftTool("draft_task", { title: "x", dueDate: "2026-09-20", assignee: "r" }, { ...c2, state: { ...st2, users: [{ id: "a", name: "Rana", active: true }, { id: "b", name: "Rami", active: true }] } }));
const dc: any = draftTool("draft_contract", { counterparty: "Omar Films", project: "skf", startDate: "2026-10-01", endDate: "2026-12-31", monthlyFee: 500, contractTotal: 1500, role: "Editor" }, c2);
ok("a contract card only opens the form (D4)", dc.proposal?.confirmRoute === "form:contract" && dc.proposal.data.party === "vendor" && dc.proposal.data.kind === "Service");
ok("a blocked provider gets no contract card", "error" in draftTool("draft_contract", { counterparty: "Blocked Films", project: "SKF", startDate: "2026-10-01", endDate: "2026-12-31", monthlyFee: 1, contractTotal: 1, role: "x" }, c2));
ok("an end before the start is refused", "error" in draftTool("draft_contract", { counterparty: "Omar Films", project: "SKF", startDate: "2026-12-01", endDate: "2026-10-01", monthlyFee: 1, contractTotal: 1, role: "x" }, c2));
const dr: any = draftTool("draft_request", { title: "Bulk upload", need: "upload 20 receipts at once", door: "banking", urgency: "high" }, c2);
ok("a request card drops a door the user lacks", dr.proposal?.data.door === "" && dr.proposal.confirmRoute === "/api/requests/save");
ok("the route shows a card and saves nothing", /draftTool\(c\.name, c\.input, ctx\)[\s\S]{0,200}actions\.push\(a\)[\s\S]{0,200}"Anna Draft", `turn \$\{turn\} · \$\{c\.name\}`/.test(route));
const labelled = (path: string) => { const a = server.indexOf(`app.post("${path}"`); const b = server.indexOf("\n});\n", a); return a > 0 && /\$\{draftedBy\(req\)\}`/.test(server.slice(a, b)); };
ok("the three save routes label an Anna save in their audit line", ["/api/quotations/save", "/api/compliance/save", "/api/requests/save"].every(labelled));
ok("the label reads one header, nothing else", /const draftedBy = \(req: any\) => req\.get\?\.\("X-Drafted-By"\) === "anna" \? " \(drafted by Anna\)" : "";/.test(server));
ok("an Edit-then-Save sends the label only for a new record",
  /fromAnna && !quoteForm\.id \? \{ "X-Drafted-By": "anna" \}/.test(read("../src/tabs/ProductionTab.tsx"))
  && /fromAnna && !taskForm\.id \? \{ "X-Drafted-By": "anna" \}/.test(read("../src/tabs/MyDeskTab.tsx")));
const reqSave = server.slice(server.indexOf('app.post("/api/requests/save"'), server.indexOf('app.post("/api/requests/triage"'));
ok("a filed request always starts New, under the signed-in user", /status: "New", createdBy: user\.id/.test(reqSave) && !/status\b[^:]*=\s*req\.body/.test(reqSave));
ok("only the master account triages", /"\/api\/requests\/triage": \["Super Admin"\]/.test(read("../src/gates.ts"))
  && /if \(user\?\.role !== "Super Admin"\) return res\.status\(403\)/.test(server.slice(server.indexOf('app.post("/api/requests/triage"'))));

console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
