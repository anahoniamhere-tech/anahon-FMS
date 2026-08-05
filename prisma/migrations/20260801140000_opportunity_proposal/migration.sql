-- Proposal workspace on the funding funnel: sections, indicative budget, timeline.
ALTER TABLE "Opportunity" ADD COLUMN "proposalJson" TEXT NOT NULL DEFAULT '{}';
