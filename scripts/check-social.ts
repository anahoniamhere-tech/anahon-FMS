// Social desk self-check — pure asserts on src/meta.ts, no network, no database.
// Run: npx tsx scripts/check-social.ts
import assert from "node:assert";
import { imagesOf, CAROUSEL_MIN, CAROUSEL_MAX, nextAttemptAt, isDue, gateRelease, composeText, planPublish, initialState, connectUrl, BACKOFF_MINUTES, hintFor, isFinalError, isPending, GraphError, MAX_VIDEO_BYTES, VIDEO_MIMES, MAX_IMAGE_BYTES, IMAGE_MIMES, graph } from "../src/meta";
import { periodCount, periodTotals } from "../src/insights";

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
// An uploaded image (doc:) is a Facebook photo post from bytes; Instagram still refuses anything that is not a public address.
assert.deepStrictEqual(planPublish({ network: "facebook", message: "", link: "", imageUrl: "doc:doc-9" }), { kind: "fb-photo" });
assert.match(planPublish({ network: "instagram", message: "hi", link: "", imageUrl: "doc:doc-9" }).error!, /public HTTPS/);
assert.ok(IMAGE_MIMES.includes("image/webp") && MAX_IMAGE_BYTES === 10 * 1024 * 1024);

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

// ---- the stored series ----------------------------------------------------------------------
// A figure the export did not give must stay null. This is the assert that keeps a "—" from
// turning into a "0" in a funder's proposal.
assert.strictEqual(periodCount(""), null);
assert.strictEqual(periodCount(undefined), null);
assert.strictEqual(periodCount(null), null);
assert.strictEqual(periodCount(0), 0, "an explicit zero is a real figure and is kept");
assert.strictEqual(periodCount("11221433"), 11221433);
assert.strictEqual(periodCount(-5), 0, "a negative count is not a thing");
assert.strictEqual(periodCount("3.6"), 4);
assert.strictEqual(periodCount("not a number"), 0);

// Reach adds up across periods; followers is a level and is the latest one, never a sum.
const series = [
  { platform: "Instagram", periodEnd: "2023-12-31", reach: 1_119_545, followers: 10_000 },
  { platform: "Instagram", periodEnd: "2024-03-31", reach: 500_000, followers: 12_000 },
  { platform: "YouTube", periodEnd: "2023-12-31", views: 67_786, followers: null },
];
const t = Object.fromEntries(periodTotals(series));
assert.strictEqual(t.Instagram.reach, 1_619_545, "reach adds across periods");
assert.strictEqual(t.Instagram.last!.followers, 12_000, "followers is the latest level, not 22,000");
assert.strictEqual(t.YouTube.views, 67_786);
assert.strictEqual(t.YouTube.last, null, "a platform that reports no followers has no level to show");
assert.strictEqual(periodTotals(series)[0][0], "Instagram", "biggest platform first");

console.log("check-social: stored-series asserts passed");

// ---- carousels (9 Sep 2026) -------------------------------------------------------------------
// imagesOf is the single source of truth: a carousel fills imagesJson, an ordinary post fills
// imageUrl, and every row written before this existed keeps working.
assert.deepStrictEqual(imagesOf({ imageUrl: "https://x/a.jpg", imagesJson: "[]" }), ["https://x/a.jpg"], "a legacy row still has its image");
assert.deepStrictEqual(imagesOf({ imageUrl: "", imagesJson: "[]" }), [], "no image is no image");
assert.deepStrictEqual(imagesOf({ imageUrl: "https://x/a.jpg", imagesJson: '["https://x/b.jpg","https://x/c.jpg"]' }),
  ["https://x/b.jpg", "https://x/c.jpg"], "the list wins when it is set");
assert.deepStrictEqual(imagesOf({ imagesJson: "not json" } as any), [], "a corrupt list is no images, never a crash");
assert.deepStrictEqual(imagesOf({ imagesJson: '["  ", "https://x/a.jpg"]' } as any), ["https://x/a.jpg"], "blank entries are dropped");

const P = "https://x.org/p.jpg", Q = "https://x.org/q.jpg";
const plan = (network: string, imagesJson: string, extra: any = {}) =>
  planPublish({ network, message: "m", link: "", imageUrl: "", imagesJson, ...extra } as any);
assert.strictEqual(plan("facebook", JSON.stringify([P, Q])).kind, "fb-carousel");
assert.strictEqual(plan("instagram", JSON.stringify([P, Q])).kind, "ig-carousel");
assert.strictEqual(plan("facebook", JSON.stringify([P])).kind, "fb-photo", "one image is a photo, not a carousel");
assert.strictEqual(plan("instagram", JSON.stringify([P])).kind, "ig-image");
assert.strictEqual(plan("facebook", JSON.stringify(["doc:1", "doc:2"])).error, undefined,
  "Facebook takes vault bytes in a carousel");
assert.match(plan("instagram", JSON.stringify([P, "doc:2"])).error!, /public HTTPS/,
  "Instagram fetches every child itself, so one vault image spoils the carousel");
assert.match(plan("facebook", JSON.stringify(Array(CAROUSEL_MAX + 1).fill(P))).error!, new RegExp(`at most ${CAROUSEL_MAX}`));
assert.strictEqual(plan("facebook", JSON.stringify(Array(CAROUSEL_MAX).fill(0).map((_, i) => `${P}?${i}`))).error, undefined,
  `${CAROUSEL_MAX} images is still allowed`);
assert.match(plan("facebook", JSON.stringify([P, Q]), { videoRef: "doc:9" }).error!, /One media per post/,
  "a video and a carousel together is still refused");
assert.ok(CAROUSEL_MIN === 2 && CAROUSEL_MAX === 10, "Instagram publishes 2..10 carousel items");

console.log("check-social: carousel asserts passed");

// ---- the media library only offers media that still has bytes ---------------------------------
// A document row outlives its file: on 9 Sep 2026, 14 of the 18 image documents in the vault
// pointed at files that were gone from both the NAS and the Mac mirror. The picker listed them,
// so an editor could choose an image that could not be posted and then read a refusal telling
// them to "upload it here first" — about a file they had just picked out of the library.
import { readFileSync } from "node:fs";
const srv = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const mediaRoute = srv.slice(srv.indexOf('app.get("/api/social/media"'), srv.indexOf('app.get("/api/social/insights"'));
assert.ok(/vaultPathFromPointer/.test(mediaRoute) && /existsSync/.test(mediaRoute),
  "the media library must offer only documents whose bytes are still in the vault");
assert.ok(/base64:\s*true/.test(mediaRoute), "…which means it has to read the pointer to check");
assert.ok(/\.map\(\(\{ base64, \.\.\.d \}\) => d\)/.test(mediaRoute),
  "…and the pointer must be stripped before the list reaches the browser");
// The refusal must name the real cause rather than sending someone in a circle.
assert.ok(/file is missing from the vault/.test(srv),
  "a document whose bytes are gone must say so, not 'upload it here first'");

console.log("check-social: media-library asserts passed");

// ---- a vault image made fetchable by Meta -----------------------------------------------------
// Instagram fetches every image itself, so /api/social/image-public copies a vault image onto the
// website and returns its address. Two things must hold, and both are about not lying to an editor.
const pub = srv.slice(srv.indexOf('app.post("/api/social/image-public"'), srv.indexOf('// ---- the stored series'));
assert.ok(pub.length > 200, "the image-public route must exist");
// 1. It must refuse to build a URL on an address Meta cannot reach.
assert.ok(/\^https:\\\/\\\//.test(pub) || /https:\\\/\\\//.test(pub),
  "it must require SITE_PUBLIC_URL to be https:// before handing out an address");
assert.ok(/SITE_PUBLIC_URL/.test(pub), "…read from SITE_PUBLIC_URL, not invented");
// 2. It must not report an address that does not answer yet: the site is a static build, so a file
//    in public/uploads is not live until Astro rebuilds and push.sh rsyncs dist/.
assert.ok(/__build/.test(pub), "it must rebuild the site after copying the file");
assert.ok(/method: "HEAD"/.test(pub), "…and check the address actually answers before calling it live");
assert.ok(/502/.test(pub), "…and fail loudly when it does not");
// The same guards the post route uses: category, personnel, real bytes.
for (const guard of ["SOCIAL_MEDIA_CATEGORIES", "isPersonnelDoc", "existsSync", "looksLikeMedia"]) {
  assert.ok(pub.includes(guard), `image-public must apply the same ${guard} guard the post route does`);
}
// Deterministic naming: publishing the same image twice must not litter the site with copies.
assert.ok(/contentHash/.test(pub), "the published filename must derive from the content, not the clock");
assert.ok(!/Date\.now\(\)/.test(pub), "…so no timestamp in the name");

console.log("check-social: image-public asserts passed");
