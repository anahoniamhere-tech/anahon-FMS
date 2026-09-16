/**
 * Editorial pipeline gates — Policies P3 (Editorial) & 005 (Fact-Checking) as code.
 *
 * Pure module, no I/O: imported by server.ts (enforcement), EditorialTab.tsx
 * (disabled-button reasons) and scripts/check-editorial-gates.ts (asserts), so the
 * server's 403 text and the UI's explanation can never disagree — same pattern as
 * selfDealing.ts. Every constant and blocker below traces to a policy sentence.
 */

export const CONTENT_STATUSES = [
  "Assigned", "In Production", "Fact-Check", "Editorial Review", "Approved", "Published"
] as const;

// Policy P3: "multiple types of content — infographics, reels, short documentaries,
// interviews, posts…" plus podcasts and articles named under Responsibilities.
export const CONTENT_TYPES: string[] = [
  "Infographic", "Reel", "Short Documentary", "Interview", "Post", "Podcast", "Article"
];

// Policy P3: "our chain of channels — WhatsApp, Facebook, Instagram, YouTube, WEBSITE."
export const CONTENT_CHANNELS: string[] = ["WhatsApp", "Facebook", "Instagram", "YouTube", "Website"];

// Policy P3 content standards — each checkbox is a policy sentence, not a vibe.
export const CONTENT_CHECKS: [key: string, label: string, policySentence: string][] = [
  ["researched",         "Thoroughly researched",                      "All content must be thoroughly researched and fact-checked (Policy P3 — Accuracy)"],
  ["balanced",           "Balanced and unbiased",                      "Content should present information in a balanced and unbiased manner (Policy P3 — Objectivity)"],
  ["sourcesVerified",    "Credible sources, authenticity verified",    "Sources must be credible, and their authenticity verified (Policy P3 — Accuracy)"],
  ["originalWork",       "No plagiarism, copyright respected",         "Avoid plagiarism and respect copyright laws (Policy P3 — Ethical Standards)"],
  ["conflictsDisclosed", "Conflicts of interest disclosed",            "Any potential conflicts of interest must be disclosed (Policy P3 — Ethical Standards)"],
  ["inclusive",          "Diverse voices, no discriminatory language", "Ensure representation of diverse voices; avoid discriminatory language (Policy P3 — Inclusivity)"],
  ["solutionsFocused",   "Solutions focus, multiple perspectives",     "Focus on solution journalism with multiple approaches and perspectives (Policy P3 — Positive Journalism)"]
];

/**
 * Why this post may not go to a social account; empty ⇒ it may.
 *
 * Policy P3 names AnaHon's own channels — "WhatsApp, Facebook, Instagram, YouTube, WEBSITE" —
 * and then requires that ALL content pass editorial review and carry the Production Manager AND
 * Programs Director approvals BEFORE publication. There is no channel exemption in it: a caption
 * on Instagram is published content exactly as an article on the website is.
 *
 * Until 9 Sep 2026 `contentItemId` was optional on /api/social/queue, so a post with no piece
 * behind it was queued immediately — no fact-check, no dual approval, no standards, no legal
 * review, no AI disclosure. This is the guard that closes that. It does NOT decide *when* a post
 * goes out: a piece still in the pipeline yields a Draft that the gate releases on publish
 * (src/meta.ts initialState). It only refuses a post that no piece is answerable for.
 */
export function socialPostBlockers(item: { status: string; retractedAt: string; rehearsal?: boolean } | null): string[] {
  if (!item) return ["Every post carries a piece from the editorial register — Policy P3 covers Facebook and Instagram exactly as it covers the website, and all content is reviewed and approved before it is published. Create or pick the piece, and the post goes out when the piece is cleared."];
  if (item.retractedAt) return ["That piece has been retracted — its posts were cancelled and it may not be promoted again (Policy P4)."];
  if ((item as any).rehearsal) return ["That piece is a rehearsal — a walk-through of the chain, not a publication. Nothing from it goes to a social account."];
  return [];
}

/**
 * Policy P3 "Content Types" — the label the published piece must carry.
 *
 * NOT the same as CONTENT_TYPES above, which is the format (Article, Reel, Podcast…). The policy
 * defines three kinds of content and requires each be distinguishable from the others:
 *   News       — "Clearly label all news articles, reports, and broadcasts as 'News'"
 *   Commercial — "Clearly identify all commercial content with labels such as 'Sponsored',
 *                 'Advertisement', or 'Paid Content'" and "maintain transparency about any
 *                 commercial relationships or sponsorships associated with the content"
 *   Opinion    — "Clearly label all opinion content with headings such as 'Opinion',
 *                 'Editorial', or 'Commentary'"
 * Until 9 Sep 2026 the system could not record this at all, so sponsored content could not be
 * marked as sponsored anywhere in the FMS.
 */
export const CONTENT_LABELS: [key: string, word: string, policySentence: string][] = [
  ["News", "News", "Clearly label all news articles, reports, and broadcasts as \"News\" (Policy P3 — Content Types)"],
  ["Commercial", "Sponsored", "Clearly identify all commercial content with labels such as \"Sponsored\", \"Advertisement\" or \"Paid Content\", and maintain transparency about the commercial relationship (Policy P3 — Content Types)"],
  ["Opinion", "Opinion", "Clearly label all opinion content with headings such as \"Opinion\", \"Editorial\" or \"Commentary\" (Policy P3 — Content Types)"],
];
/**
 * The words a piece may carry (P3 §3, amended 16 Sep 2026), each with its kind. `contentLabel` stores the
 * WORD; every rule groups on the kind. The bare kind keys from before the amendment stay valid:
 * "News" and "Opinion" are words too, and a legacy "Commercial" reads as "Sponsored".
 */
export const LABEL_WORDS: [word: string, kind: string][] = [
  ["News", "News"],
  ["Sponsored", "Commercial"], ["Advertisement", "Commercial"], ["Paid Content", "Commercial"],
  ["Opinion", "Opinion"], ["Editorial", "Opinion"], ["Commentary", "Opinion"],
];
/** The P3 kind of a stored label — "News", "Commercial", "Opinion" — or "" when it is none of them. */
export const labelKind = (contentLabel: string): string =>
  contentLabel === "Commercial" ? "Commercial" : LABEL_WORDS.find(([w]) => w === contentLabel)?.[1] || "";
export const isContentLabel = (contentLabel: string) => !!labelKind(String(contentLabel || ""));
/** The label word a published piece carries in front of its text; "" for an unlabelled piece. */
export const labelWord = (contentLabel: string) =>
  contentLabel === "Commercial" ? "Sponsored" : labelKind(contentLabel) ? contentLabel : "";
/** News is what the audience assumes; the other two kinds must be told apart from it on the piece itself. */
export const labelNeedsMarking = (contentLabel: string) => ["Commercial", "Opinion"].includes(labelKind(contentLabel));

/** A production draft on a piece: the renditions the fact-checker verifies (schema draftsJson). */
export type ContentDraft = { label: string; kind: string; text: string; date: string; by: string };
/** The draft kind that carries a piece's social rendition. One of the kinds the desk already offers. */
export const CAPTION_KIND = "Caption";

export type Rendition = {
  text: string;
  /** "caption" = the text the desk wrote and the fact-checker saw. "improvised" = assembled here
   *  from the title and brief, which nobody checked as a caption. */
  source: "caption" | "improvised";
  draft?: ContentDraft;
};

/**
 * What a piece says on a social account.
 *
 * Policy P3 treats a caption as published content, and the fact-checker verifies the piece's
 * drafts — so the text that goes to Facebook or Instagram should be the Caption draft that was
 * written and checked with the piece, not something retyped in the composer afterwards. Until
 * 9 Sep 2026 the composer assembled title + brief and ignored the Caption entirely.
 *
 * The newest Caption wins (drafts are appended, so the last one is the current one). When a piece
 * has none, the improvised text is still offered — an editor must be able to work — but it is
 * reported as improvised so nobody mistakes it for the verified rendition.
 */
export function socialRendition(
  item: { title?: string; brief?: string; drafts?: ContentDraft[]; contentLabel?: string } | null
): Rendition {
  const caption = [...(item?.drafts || [])].reverse()
    .find(d => d && d.kind === CAPTION_KIND && String(d.text || "").trim());
  const body = caption
    ? String(caption.text).trim()
    : [item?.title, item?.brief].filter(Boolean).join("\n\n").trim();
  // Policy P3: commercial and opinion content must be distinguishable from editorial content
  // "in terms of design, placement, and labeling". On a social account there is no design and no
  // placement — the caption is all there is — so the label goes in front of the words. News is
  // what an audience already assumes of a media platform and is not marked here.
  // Prepended into the visible text, never silently at send time: the editor sees it and may
  // reword it before it goes.
  const mark = labelNeedsMarking(item?.contentLabel || "") ? labelWord(item!.contentLabel!) : "";
  const text = mark && body && !body.startsWith(mark) ? `${mark}: ${body}` : body;
  return caption
    ? { text, source: "caption", draft: caption }
    : { text, source: "improvised" };
}

export type ContentGateFields = {
  status: string;
  factCheckPassedAt: string;
  pmApprovedBy: string;
  pdApprovedBy: string;
  legalFlag: boolean;
  legalReviewedBy: string;
  checksJson: string;
  contentLabel?: string;
  sponsorDisclosure?: string;
  aiAssisted?: boolean;
  // Rehearsal only (11 Sep 2026) — see rehearsalSeatClash below. Ignored on a real piece.
  rehearsal?: boolean;
  assigneeAs?: string | null;
  factCheckerAs?: string | null;
  pmApprovedAs?: string | null;
  pdApprovedAs?: string | null;
  aiDisclosed?: boolean;
};

/**
 * Every reason this item may not be published; empty array ⇒ publishable.
 * Policy P3: "Content should be approved by the Production Manager and Programs
 * Director before being published" + legal review when flagged. Policy P4:
 * fact-checked content approved before publication, by a named independent checker.
 */
export function publishBlockers(c: ContentGateFields): string[] {
  const blockers: string[] = [];
  if (c.status !== "Approved") blockers.push(`Status is ${c.status} — only Approved content can be published.`);
  if (!c.factCheckPassedAt) blockers.push("Fact-check has not passed (Policy P4: fact-checked before publication).");
  if (!c.pmApprovedBy) blockers.push("Production Manager approval missing (Policy P3).");
  if (!c.pdApprovedBy) blockers.push("Programs Director approval missing (Policy P3).");
  if (c.rehearsal) {
    // A rehearsal is one person in four seats, so "two different people" becomes "four different
    // seats" — and it is still refused when any two steps were taken in the same one.
    blockers.push(...rehearsalSeatsBlockers(c));
  } else if (c.pmApprovedBy && c.pdApprovedBy && c.pmApprovedBy === c.pdApprovedBy) {
    blockers.push("Both approvals are by the same person — Policy P3 requires the Production Manager AND the Programs Director.");
  }
  // Policy P3 requires every piece to be labelled News / Commercial / Opinion, and a commercial
  // piece to disclose the relationship behind it. An unlabelled piece cannot be published.
  if (!c.contentLabel) blockers.push("No content label — say whether this is News, Commercial or Opinion (Policy P3: each content type must be clearly labelled).");
  else if (!isContentLabel(c.contentLabel)) blockers.push(`"${c.contentLabel}" is not a content label Policy P3 defines (${LABEL_WORDS.map(([w]) => w).join(", ")}).`);
  else if (labelKind(c.contentLabel) === "Commercial" && !String(c.sponsorDisclosure || "").trim())
    blockers.push("Commercial content must say who paid for it or what the relationship is (Policy P3: maintain transparency about any commercial relationships or sponsorships).");
  if (c.legalFlag && !c.legalReviewedBy)
    blockers.push("Flagged for legal implications but no legal review recorded (Policy P3).");
  // The golden transparency rule: AI-assisted content publishes only with its label.
  if (c.aiAssisted && !c.aiDisclosed)
    blockers.push("AI was used on this item — confirm the AI-use watermark/disclaimer is on the published piece (transparency rule).");
  let checks: Record<string, boolean> = {};
  try { checks = JSON.parse(c.checksJson || "{}"); } catch { /* treated as unchecked */ }
  for (const [key, label] of CONTENT_CHECKS) {
    if (!checks[key]) blockers.push(`Standard unmet: ${label} (Policy P3).`);
  }
  return blockers;
}

/* ── Rehearsal: the chain walked by one person in several seats ──────────────
 * Saad is the only active holder of an editorial seat, so the real chain cannot run end to end:
 * separation compares PEOPLE (user ids) and "Act as…" changes only the seat, never the person.
 * That refusal is correct and stays — loosening it would let one login publish anything, which is
 * exactly what Policies P3 and P4 forbid.
 *
 * A rehearsal is a separate kind of item where each step must instead be taken in a different
 * SEAT. It walks every gate, and its "publish" never leaves the FMS. These rules apply ONLY when
 * `rehearsal` is set; a real piece never reads them.
 */
export const REHEARSAL_TAG = "[REHEARSAL]";
export type RehearsalStep = "factcheck" | "pass" | "pm" | "pd";
type Seats = { assigneeAs?: string | null; factCheckerAs?: string | null; pmApprovedAs?: string | null; pdApprovedAs?: string | null };

/**
 * Why `seat` may not take `step` on a rehearsal; "" when it may.
 *   factcheck — naming the fact-checker seat: never the author's seat (Policy P4 impartiality)
 *   pass      — only the seat named as fact-checker may pass it
 *   pm / pd   — an approval seat must differ from the author, the checker and the other approval
 */
export function rehearsalSeatClash(item: Seats, step: RehearsalStep, seat: string): string {
  const s = String(seat || "");
  if (!s) return "No seat — stand in a seat with Act as… first.";
  if (step === "factcheck") {
    return s === item.assigneeAs ? `The ${s} seat authored this rehearsal — name a different seat as fact-checker (Policy P4: the checker is not the author).` : "";
  }
  if (step === "pass") {
    return s !== item.factCheckerAs ? `Only the ${item.factCheckerAs || "named fact-checker"} seat can pass this — you are standing in ${s}.` : "";
  }
  const other = step === "pm" ? item.pdApprovedAs : item.pmApprovedAs;
  if (s === item.assigneeAs) return `The ${s} seat authored this rehearsal — approve it from a different seat (§4.3).`;
  if (s === item.factCheckerAs) return `The ${s} seat fact-checked this rehearsal — approve it from a different seat.`;
  if (other && s === other) return `The ${s} seat already holds the other approval — Policy P3 needs two different approvers, so use a different seat.`;
  return "";
}

/** A rehearsal publishes only with four steps taken in four different seats. */
export function rehearsalSeatsBlockers(c: Seats): string[] {
  const named: [string, string | null | undefined][] = [
    ["author", c.assigneeAs], ["fact-checker", c.factCheckerAs],
    ["Production Manager approval", c.pmApprovedAs], ["Programs Director approval", c.pdApprovedAs],
  ];
  const out = named.filter(([, v]) => !v).map(([k]) => `Rehearsal: no seat recorded for the ${k}.`);
  const seen = new Map<string, string>();
  for (const [k, v] of named) {
    if (!v) continue;
    if (seen.has(v)) out.push(`Rehearsal: the ${seen.get(v)} and the ${k} were both the ${v} seat — each step must be a different seat.`);
    else seen.set(v, k);
  }
  return out;
}

/**
 * Source and editorial material — Policy P11. One rule, read by the newsroom and by the consultant's month
 * pack (Books, 15 Sep 2026), so neither can leak a source's file the other protects. A document is source
 * material when it belongs to editorial work (a piece, its references, a meeting, the website) or its category
 * says it is raw material. The month pack also chooses its documents by whitelist; this is the second guard.
 * Editorial reviews this definition.
 */
export const EDITORIAL_RECORD_TYPES = ["Content", "Content Reference", "Meeting", "Website"] as const;
export const SOURCE_CATEGORY_PATTERN = /reference material|meeting recording|recording|interview|footage|\bsources?\b/i;
/** The category half on its own: raw material (a reference, a recording, an interview, footage, a source),
 *  as opposed to a finished asset. It decides what may leave AnaHon at all — the consultant's pack, and every
 *  route that hands a vault file to Meta or copies it onto the public site (Newsroom, 15 Sep 2026). A cover or a
 *  "Social Image" is a finished asset and passes; "Reference Material" never does. */
export function isRawSourceCategory(category: string | null | undefined): boolean {
  return SOURCE_CATEGORY_PATTERN.test(String(category || ""));
}
export function isSourceMaterial(doc: { category?: string | null; linkedRecordType?: string | null }): boolean {
  return (EDITORIAL_RECORD_TYPES as readonly string[]).includes(String(doc?.linkedRecordType || ""))
    || isRawSourceCategory(doc?.category);
}
