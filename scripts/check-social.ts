// Social desk self-check — pure asserts on src/meta.ts, no network, no database.
// Run: npx tsx scripts/check-social.ts
import assert from "node:assert";
import { nextAttemptAt, isDue, gateRelease, composeText, planPublish, initialState, connectUrl, BACKOFF_MINUTES, hintFor, isFinalError, isPending, GraphError, MAX_VIDEO_BYTES, VIDEO_MIMES, graph } from "../src/meta";

const now = new Date("2026-09-06T12:00:00.000Z");

// Retries: three gaps, then it gives up.
assert.deepStrictEqual(BACKOFF_MINUTES, [1, 5, 15]);
assert.strictEqual(nextAttemptAt(1, now), "2026-09-06T12:01:00.000Z");
assert.strictEqual(nextAttemptAt(3, now), "2026-09-06T12:15:00.000Z");
assert.strictEqual(nextAttemptAt(4, now), null, "a fourth failure is final");

// Due means queued and its time has come; drafts and future rows are not due.
assert.strictEqual(isDue({ state: "Queued", publishAt: "2026-09-06T11:59:00.000Z" }, now), true);
assert.strictEqual(isDue({ state: "Queued", publishAt: "2026-09-06T12:01:00.000Z" }, now), false);
assert.strictEqual(isDue({ state: "Draft", publishAt: "2026-09-06T11:00:00.000Z" }, now), false);

// The gate releases drafts, never earlier than now, and leaves everything else alone.
const rows = [
  { id: "a", state: "Draft", publishAt: "2026-09-01T09:00:00.000Z" },
  { id: "b", state: "Draft", publishAt: "2026-09-10T09:00:00.000Z" },
  { id: "c", state: "Queued", publishAt: "2026-09-01T09:00:00.000Z" },
  { id: "d", state: "Published", publishAt: "2026-09-01T09:00:00.000Z" }
];
const released = gateRelease(rows, now);
assert.deepStrictEqual(released.map(r => [r.id, r.state, r.publishAt]), [["a", "Queued", now.toISOString()], ["b", "Queued", "2026-09-10T09:00:00.000Z"]]);

// A new row waits for the gate unless its item already passed it (Published and not retracted).
assert.strictEqual(initialState(null), "Queued", "a free-standing post is queued");
assert.strictEqual(initialState({ status: "Published", retractedAt: "" }), "Queued");
assert.strictEqual(initialState({ status: "Approved", retractedAt: "" }), "Draft");
assert.strictEqual(initialState({ status: "Published", retractedAt: "2026-09-03T18:28:56.370Z" }), "Draft", "a retracted item releases nothing");

// Text: message and link joined by a blank line; empty parts drop out.
assert.strictEqual(composeText("Hello ", " https://anahon.org/x "), "Hello\n\nhttps://anahon.org/x");
assert.strictEqual(composeText("", "https://anahon.org/x"), "https://anahon.org/x");

// Plans: Facebook needs a message or a link; a photo makes it a photo post; Instagram needs a public image.
assert.deepStrictEqual(planPublish({ network: "facebook", message: "hi", link: "", imageUrl: "" }), { kind: "fb-feed" });
assert.match(planPublish({ network: "facebook", message: " ", link: "", imageUrl: "" }).error!, /message or a link/);
assert.deepStrictEqual(planPublish({ network: "facebook", message: "", link: "", imageUrl: "cover:content-1" }), { kind: "fb-photo" }, "a vault cover can go to Facebook as bytes");
assert.match(planPublish({ network: "instagram", message: "hi", link: "", imageUrl: "" }).error!, /needs an image/);
assert.match(planPublish({ network: "instagram", message: "hi", link: "", imageUrl: "cover:content-1" }).error!, /public HTTPS/);
assert.deepStrictEqual(planPublish({ network: "instagram", message: "hi", link: "", imageUrl: "https://anahon.org/i.jpg" }), { kind: "ig-image" });
assert.match(planPublish({ network: "tiktok", message: "hi", link: "", imageUrl: "" }).error!, /Unknown network/);

// Video: a vault video makes a Facebook video (or a Reel when asked) and always an Instagram Reel;
// one media per post; anything that is not a vault reference is refused.
const vid = { network: "facebook", message: "hi", link: "", imageUrl: "", videoRef: "doc:doc-1", asReel: false };
assert.deepStrictEqual(planPublish(vid), { kind: "fb-video" });
assert.deepStrictEqual(planPublish({ ...vid, asReel: true }), { kind: "fb-reel" });
assert.deepStrictEqual(planPublish({ ...vid, network: "instagram", message: "" }), { kind: "ig-reel" }, "Instagram video needs no caption and is always a Reel");
assert.match(planPublish({ ...vid, imageUrl: "https://x/i.jpg" }).error!, /One media per post/);
assert.match(planPublish({ ...vid, videoRef: "https://x/v.mp4" }).error!, /file in the vault/);
assert.deepStrictEqual(planPublish({ ...vid, videoRef: "" }), { kind: "fb-feed" }, "no video → the old rules");

// Meta's numbers become sentences; the file-is-wrong ones end the row without retries.
assert.match(hintFor(undefined, 2207026), /MP4/);
assert.match(hintFor(1363023), /2 GB/);
assert.match(hintFor(613), /Reels limit/);
assert.strictEqual(hintFor(999999, 8888888), "");
assert.strictEqual(isFinalError(new GraphError("x", 1363026)), true, "too long: final");
assert.strictEqual(isFinalError(new GraphError("x", 100, 2207026)), true, "bad format: final");
assert.strictEqual(isFinalError(new GraphError("x", 4)), false, "throttled: retry");
assert.strictEqual(isFinalError(new Error("network")), false);
assert.strictEqual(isPending({ containerId: "c1" }), true);
assert.strictEqual(isPending({ postId: "p", permalink: "" }), false);
assert.ok(MAX_VIDEO_BYTES === 300 * 1024 * 1024 && VIDEO_MIMES.includes("video/quicktime"));

// The connect URL carries the redirect, the state and the scopes; Instagram scopes only when asked.
const u = connectUrl("123", "https://fms.example/api/social/meta/callback", "st4te", false);
assert.ok(u.startsWith("https://www.facebook.com/v25.0/dialog/oauth?client_id=123&"));
assert.ok(u.includes("redirect_uri=https%3A%2F%2Ffms.example%2Fapi%2Fsocial%2Fmeta%2Fcallback") && u.includes("state=st4te"));
assert.ok(!u.includes("instagram_content_publish") && connectUrl("123", "x", "s", true).includes("instagram_content_publish"));

// graph() treats a non-JSON or non-2xx answer as a failure — never as a post whose id is "undefined".
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => new Response("<html>bad gateway</html>", { status: 502 })) as any;
assert.ok((await graph("/x").catch(e => e)) instanceof GraphError, "502 with an HTML body → GraphError");
globalThis.fetch = (async () => new Response("", { status: 200 })) as any;
assert.ok((await graph("/x").catch(e => e)) instanceof GraphError, "200 with an empty body → GraphError");
globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "bad", code: 100, error_subcode: 2207026 } }), { status: 400 })) as any;
const ge = await graph("/x").catch(e => e);
assert.ok(ge instanceof GraphError && ge.subcode === 2207026 && /MP4/.test(ge.message) && isFinalError(ge), "Meta's subcode becomes a sentence and is final");
globalThis.fetch = (async () => new Response(JSON.stringify({ id: "1_2" }), { status: 200 })) as any;
assert.deepStrictEqual(await graph("/x"), { id: "1_2" });
globalThis.fetch = realFetch;

console.log("check-social: all asserts passed");
