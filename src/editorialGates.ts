/**
 * Editorial pipeline gates — Policies 002 (Editorial) & 005 (Fact-Checking) as code.
 *
 * Pure module, no I/O: imported by server.ts (enforcement), EditorialTab.tsx
 * (disabled-button reasons) and scripts/check-editorial-gates.ts (asserts), so the
 * server's 403 text and the UI's explanation can never disagree — same pattern as
 * selfDealing.ts. Every constant and blocker below traces to a policy sentence.
 */

export const CONTENT_STATUSES = [
  "Assigned", "In Production", "Fact-Check", "Editorial Review", "Approved", "Published"
] as const;

// Policy 002: "multiple types of content — infographics, reels, short documentaries,
// interviews, posts…" plus podcasts and articles named under Responsibilities.
export const CONTENT_TYPES: string[] = [
  "Infographic", "Reel", "Short Documentary", "Interview", "Post", "Podcast", "Article"
];

// Policy 002: "our chain of channels — WhatsApp, Facebook, Instagram, YouTube, WEBSITE."
export const CONTENT_CHANNELS: string[] = ["WhatsApp", "Facebook", "Instagram", "YouTube", "Website"];

// Policy 002 content standards — each checkbox is a policy sentence, not a vibe.
export const CONTENT_CHECKS: [key: string, label: string, policySentence: string][] = [
  ["researched",         "Thoroughly researched",                      "All content must be thoroughly researched and fact-checked (Policy 002 — Accuracy)"],
  ["balanced",           "Balanced and unbiased",                      "Content should present information in a balanced and unbiased manner (Policy 002 — Objectivity)"],
  ["sourcesVerified",    "Credible sources, authenticity verified",    "Sources must be credible, and their authenticity verified (Policy 002 — Accuracy)"],
  ["originalWork",       "No plagiarism, copyright respected",         "Avoid plagiarism and respect copyright laws (Policy 002 — Ethical Standards)"],
  ["conflictsDisclosed", "Conflicts of interest disclosed",            "Any potential conflicts of interest must be disclosed (Policy 002 — Ethical Standards)"],
  ["inclusive",          "Diverse voices, no discriminatory language", "Ensure representation of diverse voices; avoid discriminatory language (Policy 002 — Inclusivity)"],
  ["solutionsFocused",   "Solutions focus, multiple perspectives",     "Focus on solution journalism with multiple approaches and perspectives (Policy 002 — Positive Journalism)"]
];

/**
 * Why this post may not go to a social account; empty ⇒ it may.
 *
 * Policy 002 names AnaHon's own channels — "WhatsApp, Facebook, Instagram, YouTube, WEBSITE" —
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
export function socialPostBlockers(item: { status: string; retractedAt: string } | null): string[] {
  if (!item) return ["Every post carries a piece from the editorial register — Policy 002 covers Facebook and Instagram exactly as it covers the website, and all content is reviewed and approved before it is published. Create or pick the piece, and the post goes out when the piece is cleared."];
  if (item.retractedAt) return ["That piece has been retracted — its posts were cancelled and it may not be promoted again (Policy 005)."];
  return [];
}

export type ContentGateFields = {
  status: string;
  factCheckPassedAt: string;
  pmApprovedBy: string;
  pdApprovedBy: string;
  legalFlag: boolean;
  legalReviewedBy: string;
  checksJson: string;
  aiAssisted?: boolean;
  aiDisclosed?: boolean;
};

/**
 * Every reason this item may not be published; empty array ⇒ publishable.
 * Policy 002: "Content should be approved by the Production Manager and Programs
 * Director before being published" + legal review when flagged. Policy 005:
 * fact-checked content approved before publication, by a named independent checker.
 */
export function publishBlockers(c: ContentGateFields): string[] {
  const blockers: string[] = [];
  if (c.status !== "Approved") blockers.push(`Status is ${c.status} — only Approved content can be published.`);
  if (!c.factCheckPassedAt) blockers.push("Fact-check has not passed (Policy 005: fact-checked before publication).");
  if (!c.pmApprovedBy) blockers.push("Production Manager approval missing (Policy 002).");
  if (!c.pdApprovedBy) blockers.push("Programs Director approval missing (Policy 002).");
  if (c.pmApprovedBy && c.pdApprovedBy && c.pmApprovedBy === c.pdApprovedBy)
    blockers.push("Both approvals are by the same person — Policy 002 requires the Production Manager AND the Programs Director.");
  if (c.legalFlag && !c.legalReviewedBy)
    blockers.push("Flagged for legal implications but no legal review recorded (Policy 002).");
  // The golden transparency rule: AI-assisted content publishes only with its label.
  if (c.aiAssisted && !c.aiDisclosed)
    blockers.push("AI was used on this item — confirm the AI-use watermark/disclaimer is on the published piece (transparency rule).");
  let checks: Record<string, boolean> = {};
  try { checks = JSON.parse(c.checksJson || "{}"); } catch { /* treated as unchecked */ }
  for (const [key, label] of CONTENT_CHECKS) {
    if (!checks[key]) blockers.push(`Standard unmet: ${label} (Policy 002).`);
  }
  return blockers;
}
