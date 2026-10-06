/**
 * The ten rows AnaHon logged in FPU's MDM sheet (AnaHon_Diversity_Tracker_Structure_Phase1.xlsx,
 * Drive 1ALi2-MA0E7i6eOBD_nX1pPYJK70OKDCe), brought in as history — P3 §4.1's tracker did not
 * start empty.
 *
 * The sheet's own words are kept: programme ("AnaHon - SKF") is NOT forced onto a STREAM, and a
 * value the vocabulary cannot hold ("Yes (Mainly)") becomes "yes" with the original wording added
 * to the notes, so the nuance survives without being stored as data it is not.
 *
 * Idempotent: a row already imported with the same link is updated, never duplicated.
 * Run: npx tsx scripts/import-diversity-sheet.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";
import { isPresenceValue, VULNERABLE_GROUPS, MAIN_SUBJECTS } from "../src/diversity";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

type Row = {
  loggedOn: string; title: string; description: string; programmeText: string; contentTypeText: string;
  authorText: string; formatText: string; mainSubject: string; mentionedWomen: string; mentionedMen: string;
  groups: string[]; expertWomen: string; expertMen: string; notes: string; statusText: string; link: string;
};

const G = Object.fromEntries(VULNERABLE_GROUPS.map(([k]) => [k, k]));
const ROWS: Row[] = [
  { loggedOn: "2026-01-26", title: "Don't Go Through It Alone", description: "We all go through a moment of weakness — being there for someone can be enough.", programmeText: "AnaHon – IContent (Voices Unseen)", contentTypeText: "Social Commentary / Awareness", authorText: "Omar Al Abiad / iContent Team", formatText: "Investigative video", mainSubject: "man", mentionedWomen: "none", mentionedMen: "yes", groups: [G.disabilities], expertWomen: "", expertMen: "", notes: "Mental-health awareness framed supportively (no labelling or diagnosis); tagged persons with psychosocial disabilities. Sheet left both expert columns blank.", statusText: "Published", link: "https://www.instagram.com/reel/DT-uAvzjWww/" },
  { loggedOn: "2025-12-10", title: "A Virtual Interview with Bashar al-Assad", description: "Nour Al Ayi addresses a message to him on the destruction Syria suffered under his rule.", programmeText: "AnaHon – IContent (Voices Unseen)", contentTypeText: "Social Commentary / Awareness", authorText: "Nur Al Ayi / iContent Team", formatText: "Reel Video", mainSubject: "woman", mentionedWomen: "yes", mentionedMen: "yes", groups: [G["women-girls"], G.refugees, G.children, G.ethnic, G.displaced, G.religious], expertWomen: "yes", expertMen: "none", notes: "Presented by Nour Al Ayi, iContent team, Voices Unseen. Sheet recorded women mentioned as \"Yes (Mainly)\".", statusText: "Published", link: "https://www.instagram.com/reel/DSF81PlDL7H/" },
  { loggedOn: "2025-12-12", title: "Explainer on Schizophrenia", description: "People with schizophrenia are not fiction or monsters; awareness reduces stigma.", programmeText: "AnaHon – IContent (Voices Unseen)", contentTypeText: "Social Commentary / Awareness", authorText: "Alaa Hosni / iContent Team", formatText: "Reel Video", mainSubject: "woman", mentionedWomen: "yes", mentionedMen: "none", groups: [G.disabilities], expertWomen: "yes", expertMen: "none", notes: "Expert input from a psychology background, applied through narrative rather than clinical intervention.", statusText: "Published", link: "https://www.instagram.com/reel/DSKvNhSDL1z/" },
  { loggedOn: "2025-12-15", title: "Distorted Self-Image", description: "A distorted perception of identity and self-worth that exaggerates flaws.", programmeText: "AnaHon – IContent (Voices Unseen)", contentTypeText: "Social Commentary / Awareness", authorText: "Nidaa Saj / iContent Team", formatText: "Reel Video", mainSubject: "man", mentionedWomen: "none", mentionedMen: "yes", groups: [G.disabilities, G["women-girls"]], expertWomen: "yes", expertMen: "", notes: "Person-first, non-stigmatising language; frames social pressure as especially affecting women and girls. Sheet left the men-experts column blank.", statusText: "Published", link: "https://www.instagram.com/reel/DSSjD4lCJIa/" },
  { loggedOn: "2025-12-19", title: "Lebanese Detainees in Al-Hol Camp: The Reality of Women and Children and Pathways for Their Return to Lebanon", description: "A rights-based article on Lebanese women and children detained in Al-Hol, and the legal and diplomatic routes home.", programmeText: "AnaHon", contentTypeText: "Investigative / Human Rights", authorText: "AnaHon Editorial Team", formatText: "Article", mainSubject: "man", mentionedWomen: "yes", mentionedMen: "yes", groups: [G["women-girls"], G.refugees, G.children], expertWomen: "yes", expertMen: "yes", notes: "Legal input from lawyer Mohammad Sablouh on repatriation. Sheet: women mentioned \"Yes (Mainly)\"; experts recorded as \"Yes (Social Worker)\" and \"Yes (Legal expert)\". The MDM fellowship's submitted piece.", statusText: "Published", link: "https://anahon.org/lebanese-women-and-children-in-al-hol-when-time-becomes-a-violation/" },
  { loggedOn: "2026-09-26", title: "ملفات ٣٠٣ أو ما يُسمّى بـ وثائق الاتصال", description: "شهادة حيّة عن التوقيف التعسّفي في لبنان في ظلّ ملفات ٣٠٣.", programmeText: "AnaHon - SKF", contentTypeText: "Investigative / Human Rights", authorText: "AnaHon Editorial Team", formatText: "Investigative video", mainSubject: "man", mentionedWomen: "none", mentionedMen: "5", groups: ["none"], expertWomen: "none", expertMen: "yes", notes: "Sheet recorded the men-experts column as \"Yes (Legal expert)\" and left the vulnerable-group column empty against a \"None\" expert note.", statusText: "Published", link: "https://www.facebook.com/reel/1108181278049956" },
  { loggedOn: "2025-05-07", title: "Foreign Journalists in Lebanon: Testimonies from the 2024 War Zone", description: "Why foreign journalists matter in conflict zones.", programmeText: "AnaHon - Maharat", contentTypeText: "Media Landscape", authorText: "AnaHon Editorial Team", formatText: "Multimedia Article", mainSubject: "man", mentionedWomen: "none", mentionedMen: "3", groups: ["none"], expertWomen: "none", expertMen: "3", notes: "Sheet recorded \"3 men experts\".", statusText: "Published", link: "https://anahon.org/%d9%88%d8%ac%d9%88%d8%af-%d8%a7%d9%84%d8%b5%d8%ad%d8%a7%d9%81%d9%8a%d9%8a%d9%86-%d8%a7%d9%84%d8%a3%d8%ac%d8%a7%d9%86%d8%a8-%d9%81%d9%8a-%d9%84%d8%a8%d9%86%d8%a7%d9%86-%d8%b6%d8%b1%d9%88%d8%b1%d8%a9/" },
  { loggedOn: "2026-04-24", title: "العهد الجديد: ملفات أمنية وقضائية معقدة | مع المحامي محمد صبلوح #03", description: "الحلقة الثالثة من بودكاست «كل مسؤول مسؤول» مع المحامي محمد صبلوح.", programmeText: "AnaHon", contentTypeText: "Investigative / Human Rights", authorText: "AnaHon Editorial Team", formatText: "Podcast", mainSubject: "man", mentionedWomen: "none", mentionedMen: "2", groups: ["none"], expertWomen: "none", expertMen: "2", notes: "Sheet recorded \"2 men experts\".", statusText: "Published", link: "https://www.facebook.com/share/p/1Brb2PHWEv/" },
  { loggedOn: "2025-09-12", title: "نقيب المحامين في الشمال وحرية التعبير", description: "المحامي محمد صبلوح في مواجهة التعذيب والظلم، وسؤال حماية النقابة.", programmeText: "AnaHon", contentTypeText: "Human Rights", authorText: "AnaHon Editorial Team", formatText: "Short video", mainSubject: "man", mentionedWomen: "none", mentionedMen: "2", groups: ["none"], expertWomen: "none", expertMen: "none", notes: "", statusText: "Published", link: "https://www.facebook.com/reel/792962070089389" },
  { loggedOn: "2025-06-22", title: "ائتلاف السيادة والعدالة الانتقالية", description: "تحرك حقوقي من طرابلس في مواجهة وثائق الاتصال ومذكرات الإخضاع.", programmeText: "AnaHon", contentTypeText: "Human Rights / Governance", authorText: "AnaHon Editorial Team", formatText: "Article", mainSubject: "man", mentionedWomen: "yes", mentionedMen: "yes", groups: ["none"], expertWomen: "none", expertMen: "none", notes: "", statusText: "Published", link: "https://anahon.org/from-tripoli-coalition-to-sue-security-agencies-over-fabricated-files-and-subjugation-warrants/" },
];

async function main() {
  // Every value must already satisfy the vocabulary the gate enforces — an import is not exempt.
  for (const r of ROWS) {
    for (const k of ["mentionedWomen", "mentionedMen", "expertWomen", "expertMen"] as const) {
      const v = (r as any)[k];
      if (v && !isPresenceValue(v)) throw new Error(`${r.title}: "${v}" is not a tracker value for ${k}`);
    }
    if (!MAIN_SUBJECTS.some(([k]) => k === r.mainSubject)) throw new Error(`${r.title}: bad main subject`);
    for (const g of r.groups) if (g !== "none" && !VULNERABLE_GROUPS.some(([k]) => k === g)) throw new Error(`${r.title}: bad group ${g}`);
  }
  const items = await prisma.contentItem.findMany({ select: { id: true, title: true, websiteUrl: true, rehearsal: true } });
  let linked = 0, created = 0, updated = 0;
  for (const r of ROWS) {
    // Link only on a real match: the piece's published URL, or its exact title. Never a guess.
    const match = items.find(i => !i.rehearsal && i.websiteUrl && r.link && i.websiteUrl === r.link)
      || items.find(i => !i.rehearsal && i.title.trim() === r.title.trim());
    if (match) linked++;
    const existing = await prisma.diversityEntry.findFirst({ where: { link: r.link, imported: true } });
    const data = {
      contentItemId: match?.id || null, loggedOn: r.loggedOn, title: r.title, description: r.description,
      programmeText: r.programmeText, contentTypeText: r.contentTypeText, authorText: r.authorText,
      formatText: r.formatText, statusText: r.statusText, link: r.link, mainSubject: r.mainSubject,
      mentionedWomen: r.mentionedWomen, mentionedMen: r.mentionedMen, expertWomen: r.expertWomen,
      expertMen: r.expertMen, groupsJson: JSON.stringify(r.groups), notes: r.notes,
      imported: true, recordedBy: "FPU MDM sheet",
    };
    if (!apply) { console.log(`${existing ? "update" : "create"}${match ? " + link → " + match.id : ""}  ${r.loggedOn}  ${r.title.slice(0, 54)}`); continue; }
    if (existing) { await prisma.diversityEntry.update({ where: { id: existing.id }, data }); updated++; }
    else { await prisma.diversityEntry.create({ data: { ...data, id: `dv-sheet-${r.loggedOn}-${created}`, created_at: new Date().toISOString() } }); created++; }
  }
  console.log(apply ? `imported: ${created} created, ${updated} updated, ${linked} linked to a register piece`
                    : `dry run: ${ROWS.length} rows, ${linked} would link to a register piece. Re-run with --apply.`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
