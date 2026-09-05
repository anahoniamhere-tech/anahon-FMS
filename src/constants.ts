import { Proposal } from "./types";

// Proposal sections in AnaHon's master template order (adapted per donor afterward).
export const PROPOSAL_SECTIONS: [keyof Proposal, string, string][] = [
  ["summary", "Executive Summary", "2–4 sentences: what, for whom, how much, how long."],
  ["problem", "Problem Statement", "What problem does this solve? Evidence, context, who is affected."],
  ["solution", "Proposed Solution / Description", "What AnaHon will actually do, and why this approach."],
  ["objectives", "Objectives", "Specific objectives, one per line."],
  ["deliverables", "Deliverables", "Concrete items handed over — videos, trainings, reports…"],
  ["outputs", "Outputs", "Countable results — N creators trained, N episodes published…"],
  ["outcomes", "Outcomes / Expected Impact", "The change this produces for the audience/community."]
];

// AnaHon's five programs (user-defined, 31 Jul 2026) + the org-wide bucket for
// core/backbone funding like the SKF FSTP. AnaHon itself is always the applicant.
export const STREAMS = ["AnaHon Platform", "iContent Academy", "Ahali Al Madina", "Roots & Reach", "Production", "Core / Org-wide"];
// An event or engagement — one we attended, or one we ran. Kept beside STREAMS because
// the two are always chosen together on the same form.
export const ENGAGEMENT_KINDS = ["Conference", "Bootcamp", "Training", "Coaching", "Workshop", "Meeting", "Other"];
// Which side of it we were on. One field covers both directions.
export const ENGAGEMENT_PARTS = ["Attended", "Delivered", "Co-hosted", "Sponsored"];
// Who a contact is to us. Coach and Partner added 5 Sep 2026 — the people who help run
// a training or a coaching session were not describable before.
export const CONTACT_KINDS = ["Trainer", "Coach", "Partner", "Participant", "Organiser", "Speaker", "Other"];

export const OPP_STAGES = ["Prospect", "Drafting", "Submitted", "Awarded", "Declined"] as const;
// Editorial vocabulary lives in editorialGates.ts (shared with the server's enforcement).
export { CONTENT_STATUSES, CONTENT_TYPES, CONTENT_CHANNELS, CONTENT_CHECKS, publishBlockers } from "./editorialGates";
export const QUOTE_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Invoiced", "Paid"] as const;

// Service catalog distilled from AnaHon's real quotations in Drive (Akkarouna,
// Semeurs D'avenir, War Child, Kaya…). Picking one prefills the row; every field
// stays editable. Prices are the historical list prices, not fixed.
export const SERVICE_CATALOG: { service: string; description: string; output: string; unitPrice: number }[] = [
  { service: "Event Coverage — Photo & Video (per day)", description: "Full event coverage including photography and videography.", output: "30+ edited high-res photos per day + footage for the final edit", unitPrice: 300 },
  { service: "Full-Day Shooting (4–6h)", description: "Photo + video shooting, one production day.", output: "Raw photo & video coverage", unitPrice: 300 },
  { service: "Post-Production (Editing & Delivery)", description: "Video editing (sound design, color grading, horizontal & vertical export), photo selection & editing, royalty-free music licensing, final delivery.", output: "Edited deliverables, social-media ready", unitPrice: 300 },
  { service: "Podcast Package", description: "Full podcast episode production.", output: "Full episode · poster · teaser · 2 reels · carrousel · 2× 2–5 min video · press release", unitPrice: 480 },
  { service: "Short Videos Package", description: "Short-form video set.", output: "Vox pop on the street · infographic reel · 2× talking head", unitPrice: 450 },
  { service: "Article / Research Paper", description: "Investigative article or research paper.", output: "1 published article", unitPrice: 150 },
  { service: "Social Media & Website Management (monthly)", description: "Content calendar execution, scheduling & publishing, engagement, analytics reports, website content updates, team coordination.", output: "Monthly management", unitPrice: 200 },
  { service: "Photography & Videography Training", description: "Practical training program.", output: "5 practical training sessions", unitPrice: 700 },
  { service: "Editing Training (Premiere / Mobile)", description: "Editing training.", output: "Included within training sessions", unitPrice: 300 },
  { service: "Content Production (training)", description: "Participants produce practical media content during the training.", output: "Participant-produced content", unitPrice: 500 },
  { service: "Videographer (per day)", description: "", output: "1 videographer, full day", unitPrice: 250 },
  { service: "Photographer (per day)", description: "", output: "1 photographer, full day", unitPrice: 200 },
  { service: "360° Booth Operator (per day)", description: "360° slow-motion photo booth with operator.", output: "Booth + operator, full day", unitPrice: 250 },
  { service: "Photo Editing", description: "", output: "Edited photo set", unitPrice: 100 },
  { service: "Video Editing", description: "", output: "1 edited video", unitPrice: 200 },
  { service: "Reel Editing", description: "", output: "1 edited reel (01:00–01:30)", unitPrice: 100 },
  { service: "Trending Reels Editing (10)", description: "", output: "10 trending reels (00:30–00:45)", unitPrice: 300 },
  { service: "Meeting Coverage", description: "Coverage of a formal meeting or roundtable.", output: "High-res photos + press release", unitPrice: 150 },
  { service: "Event Press Package", description: "Full event media coverage.", output: "2–5 min press video report · 1 reel · high-res photos · press release", unitPrice: 350 },
  { service: "Drone Add-on", description: "", output: "Drone footage", unitPrice: 200 },
  { service: "Training Venue", description: "Training space for all sessions.", output: "Venue rental", unitPrice: 300 },
  { service: "Coffee Break / Refreshments", description: "Refreshments for participants.", output: "Per training program", unitPrice: 200 },
  { service: "Content Production Coordination", description: "", output: "Coordination across the production", unitPrice: 150 }
];

export const FINANCIAL_TERMS = [
  "This is a prepaid service. Full payment (100%) is required before the start of production. All payments in fresh USD via OMT.",
  "The payment will be done after the delivery of the services via OMT.",
  "Full payment on the shooting day."
];
export const PRODUCTION_NOTE = "1. Editing for videos includes 2 sets of modifications; each additional set costs an extra 30 USD. 2. This quotation is for 1 day of production.";
export const TECHNICAL_NOTE = "High-quality outcome HD/4K. Equipment: Sony full-frame cameras, microphones, prime lenses, music copyrights, high-quality clear sound. All output compatible with social media.";
export const EXTRAS_DEFAULT = "1 Photographer ($100) — 1 Videographer ($130) — Add Drone ($200)";
