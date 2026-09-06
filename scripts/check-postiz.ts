// Postiz bridge self-check — pure asserts on the helpers, no network, no database.
// Run: npx tsx scripts/check-postiz.ts
import assert from "node:assert";
import { toLinks, mergeStates, outsideGate, draftGroups, channelOf, PostizPost } from "../src/postiz";

const post = (id: string, state: string, provider: string, group = "g1", extra: Partial<PostizPost> = {}): PostizPost => ({
  id, state, group, content: `<p>Hello ${id}</p>`, publishDate: "2026-09-10T09:00:00.000Z", releaseURL: null,
  integration: { id: `int-${provider}`, providerIdentifier: provider, name: `AnaHon ${provider}` }, ...extra
});

// Provider identifiers map onto the register's channel names; unknown ones pass through.
assert.strictEqual(channelOf("linkedin-page"), "LinkedIn");
assert.strictEqual(channelOf("instagram-standalone"), "Instagram");
assert.strictEqual(channelOf("mastodon"), "mastodon");

// Links strip HTML and keep the account.
const drafts = [post("a", "DRAFT", "facebook"), post("b", "DRAFT", "linkedin-page")];
const links = toLinks(drafts);
assert.strictEqual(links[0].preview, "Hello a");
assert.deepStrictEqual(links.map(l => l.channel), ["Facebook", "LinkedIn"]);

// A poll that reports nothing new changes nothing.
assert.strictEqual(mergeStates(links, drafts).changed, false);

// A poll that reports publication moves state and permalink; an error is surfaced once.
const later = [post("a", "PUBLISHED", "facebook", "g1", { releaseURL: "https://facebook.com/1" }), post("b", "ERROR", "linkedin-page")];
const m = mergeStates(links, later);
assert.strictEqual(m.changed, true);
assert.strictEqual(m.links[0].state, "PUBLISHED");
assert.strictEqual(m.links[0].releaseURL, "https://facebook.com/1");
assert.deepStrictEqual(m.errors.map(e => e.postId), ["b"]);
assert.deepStrictEqual(mergeStates(m.links, later).errors, [], "an error already recorded is not raised again");

// Posts Postiz does not know any more are left as they were.
assert.strictEqual(mergeStates(links, []).links[1].state, "DRAFT");

// Published with no content item behind it = outside the gate; linked ones are not.
const all = [...later, post("c", "PUBLISHED", "x", "g2")];
assert.deepStrictEqual(outsideGate(all, new Set(["a"])).map(p => p.id), ["c"]);

// Draft groups: one entry per composed post, already-linked drafts hidden, ordered by date.
const pool = [post("d", "DRAFT", "facebook", "g3", { publishDate: "2026-09-12T09:00:00.000Z" }), post("e", "DRAFT", "instagram", "g3", { publishDate: "2026-09-12T09:00:00.000Z" }),
  post("f", "DRAFT", "x", "g4", { publishDate: "2026-09-08T09:00:00.000Z" }), post("g", "QUEUE", "x", "g5"), post("h", "DRAFT", "x", "g6")];
const groups = draftGroups(pool, new Set(["h"]));
assert.deepStrictEqual(groups.map(g => g.group), ["g4", "g3"]);
assert.deepStrictEqual(groups[1].accounts.map(a => a.channel), ["Facebook", "Instagram"]);

console.log("check-postiz: all asserts passed");
