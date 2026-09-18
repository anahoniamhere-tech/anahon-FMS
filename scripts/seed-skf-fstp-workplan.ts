/**
 * The SKF FSTP workplan, written onto the awarded opportunity (18 Sep 2026).
 *
 * Every line comes from the countersigned agreement SKF-AN-31/2026 (vault
 * SKF-2026-FSTP/Agreement, ANH-DOC-00829) and the approved proposal v7
 * (SKF-2026-FSTP/Proposal/2026-09-04_AnaHon-Forward_REVISED_Proposal_v7.pdf) — nothing is invented.
 * The proposal's "registered civic non-profit company" is NOT repeated: AnaHon is a civil company
 * (general partnership), civil company no. 90/2023 (corrected everywhere on 17 Sep 2026).
 *
 * It sits on the opportunity because the first instalment has not arrived, and a project exists in
 * this system only once a deposit proves it. On graduation the same plan becomes activity rows.
 *
 *   npx tsx scripts/seed-skf-fstp-workplan.ts            # print it
 *   npx tsx scripts/seed-skf-fstp-workplan.ts --write    # write it to the record (NAS DB)
 */
import { PrismaClient } from "@prisma/client";

export const SKF_FSTP_WORKPLAN = {
  projectName: "AnaHon Forward — A Business and Operational Backbone for Sustainable Independent Media in North Lebanon",
  projectCode: "ANH-2026-SKF-BM-01",
  agreementNo: "SKF-AN-31/2026 — Brave Media FSTP",
  vaultCode: "SKF-2026-FSTP",
  startDate: "2026-09-10",
  endDate: "2027-03-10",
  summary:
    "A six-month institutional strengthening project with two pillars: building AnaHon's business "
    + "development, partnerships and fundraising capacity, and putting its management structures, "
    + "workflows and financial compliance on a documented footing. Implemented by the AnaHon team, "
    + "with the independent financial review contracted out.",
  pillars: [
    {
      code: "A",
      title: "Business development, partnerships and fundraising",
      activities: [
        { code: "A1", title: "Market and sustainability assessment", detail: "Client-demand survey among NGOs, institutions and businesses in North Lebanon, analysed into a costed pricing model.", months: [1, 2, 3] },
        { code: "A2", title: "Service catalogue and rate card", detail: "Production, content creation and training, consultancy — packaged with a rate card, promotional portfolio and showreel.", months: [2, 3, 4] },
        { code: "A3", title: "Partnership conversion", detail: "Turn the cooperation agreements with Ward, Spotlight, LSC and Horras Al Madina, and comparable peers, into paid or co-funded engagements.", months: [1, 2, 3, 4, 5, 6] },
        { code: "A4", title: "Sales pipeline", detail: "A managed pipeline, with the team coached to use it.", months: [2, 3, 4, 5, 6] },
        { code: "A5", title: "Membership and fundraising pilot", detail: "Payment channel, campaign videos and targeted promotion to AnaHon's existing audience, led by the Chief Editor.", months: [3, 4, 5, 6] },
      ],
    },
    {
      code: "B",
      title: "Management structures, workflows and compliance",
      activities: [
        { code: "B1", title: "Operations manual", detail: "Editorial sign-off chain, post-production QC checklist, role matrix and crisis contingency protocol, applied on at least two live productions.", months: [1, 2, 3, 4] },
        { code: "B2", title: "Financial systems consolidation", detail: "Dedicated project code, budget-line mapping, monthly reconciliation, audit-ready documentation.", months: [1, 2, 3, 4, 5, 6] },
        { code: "B3", title: "Independent financial review", detail: "First external review of accounts and controls, addressing staff classification, income tax withholding and statutory obligations, with a recommended payroll and contracting model.", months: [4, 5, 6] },
        { code: "B4", title: "Team capability building", detail: "Practical workshops on business development, client management and the new workflows, so the systems survive beyond the grant.", months: [1, 2, 3, 4, 5, 6] },
      ],
    },
  ],
  milestones: [
    { date: "2026-09-10", title: "Agreement effective; project launch, systems set-up, project code and timesheets in use", kind: "Milestone" },
    { date: "2026-09-10", title: "First instalment, 30% (EUR 3,600), on approval of the proposal and this workplan", kind: "Payment" },
    { date: "2026-12-09", title: "Demand survey and analysis report delivered; service catalogue and rate card published; operations manual adopted", kind: "Milestone" },
    { date: "2026-12-10", title: "Interim reporting period ends (10 September – 10 December 2026)", kind: "Milestone" },
    { date: "2026-12-20", title: "Interim narrative and financial reports, with invoice and supporting documents, to SKF", kind: "Report" },
    { date: "2026-12-20", title: "Second instalment, 50% (EUR 6,000), on proof of 75% of the first instalment spent", kind: "Payment" },
    { date: "2027-02-28", title: "Independent financial review report and recommended payroll model", kind: "Milestone" },
    { date: "2027-03-10", title: "Implementation ends; results consolidated and sustainability roadmap agreed", kind: "Milestone" },
    { date: "2027-03-31", title: "Final narrative and financial reports, with invoice and supporting documents, to SKF", kind: "Report" },
    { date: "2027-03-31", title: "Third instalment, 20% (EUR 2,400), on acceptance of the final reports", kind: "Payment" },
  ],
  // Who the money is asked from, and the account it is paid into — copied from the signed agreement
  // SKF-AN-31/2026 (vault SKF-2026-FSTP/Agreement, ANH-DOC-00829), never retyped from memory.
  donorName: "Samir Kassir Foundation",
  attention: "Jihane Abdallah, Finance Manager",
  donorAddress: "Riverside Bloc C, 6th floor, Charles Helou Street, Sin el-Fil, Metn — Lebanon",
  cc: "Nadine Moubarak",
  bank: {
    accountName: "ANA HON - CIVIL COMPANY",
    bankName: "BLOM BANK SAL",
    branch: "Tripoli, Tell",
    accountNo: "2343794",
    iban: "LB 10 0014 0000 0402 3532 3437 9417",
    swift: "BLOMLBBX",
    source: "agreement SKF-AN-31/2026, Recipient Bank Account Details (ANH-DOC-00829)",
  },
  // Section 4.01 of the agreement, in its own terms.
  instalments: [
    { no: 1, percent: 30, amount: 3600, condition: "on signature of the agreement and SKF's approval of the technical and financial proposal (Annex 1) and of the submitted workplan (Article 4.01.a)", dueDate: "2026-09-10" },
    { no: 2, percent: 50, amount: 6000, condition: "on submission of the interim narrative and financial reports as proof of having spent 75% of the first instalment, with an invoice and supporting documents (Article 4.01.b)", dueDate: "2026-12-20" },
    { no: 3, percent: 20, amount: 2400, condition: "on submission of the final narrative and financial reports, with an invoice and supporting documents (Article 4.01.c)", dueDate: "2027-03-31" },
  ],
  basis: [
    "the agreement SKF-AN-31/2026, countersigned and on file (ANH-DOC-00829)",
    "the technical and financial proposal approved by the Selection Committee (revised version of 4 September 2026)",
    "the project workplan submitted with this request (ANH-DOC-00830)",
  ],
  results: [
    "A costed business development strategy and service catalogue in active use, with at least 3 paid service engagements signed and at least EUR 3,000 in new earned-income commitments by project end.",
    "At least two existing partnerships converted into paid or co-funded engagements.",
    "A live membership and fundraising channel with at least 150 recurring or one-off supporters.",
    "An adopted operations manual applied on at least two live productions.",
    "A settled staff-classification and payroll model, with the compliance steps to adopt it.",
    "Digitised financial management and a team trained across all new systems.",
    "Non-donor revenue rising from near zero to 15% of AnaHon's income within 12 months of project close.",
  ],
};

if (process.argv[2] === "--write") {
  const prisma = new PrismaClient();
  (async () => {
    const opp = await prisma.opportunity.findUnique({ where: { id: "opp-skf-fstp" } });
    if (!opp) throw new Error("opp-skf-fstp not found");
    const kept = JSON.parse(opp.proposalJson || "{}");
    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { proposalJson: JSON.stringify({ ...kept, workplan: SKF_FSTP_WORKPLAN }) },
    });
    console.log("written:", opp.id);
  })().finally(() => prisma.$disconnect());
} else {
  console.log(JSON.stringify(SKF_FSTP_WORKPLAN, null, 1));
}
