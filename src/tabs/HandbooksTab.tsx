import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, Search, ChevronDown, ChevronRight, History as HistoryIcon, MessageCircleQuestion, ArrowRight, AlertTriangle } from "lucide-react";
import { SharedProps } from "./shared";
import { withTicket } from "../docTicket";
import { isSupersededPointer, policyHeading } from "../helpBot";
import { NAV, ic } from "../nav";
import {
  parseHandbooksIndex, findIndexFaults, chapterAnchors, chapterSlice, missingChapterText,
  historyChapterOf, POLICY_DOORS, policyNo, type ParsedIndex, type Chapter,
} from "../handbooksIndex";
import type { AppDoc } from "../types";

/** The door's own label, the same list the sidebar draws from. */
const doorLabel = (navKey: string) => NAV.flatMap(s => s.items).find(i => i.navKey === navKey)?.label || navKey;

/** Which live document carries a handbook's text — matched on the Index's own heading
 *  word, not a policy number, so this stays an identity lookup and not a filename guess
 *  at chapter data. */
const findHandbookDoc = (heading: string, live: AppDoc[]) => {
  const keyword = heading.split(/[\s,]+/)[0].toLowerCase();
  return live.find(d => d.filename.toLowerCase().includes(keyword));
};

/** "formerly 020; accounts, procurement, ..." — the Index always states the old number
 *  first. Whatever follows becomes the one-line summary; a chapter with nothing past
 *  "formerly NNN" shows no summary line rather than an invented one (measured live —
 *  none of the 11 currently lack one, but the Index is edited by hand and could again).
 *  Presentation only: reads c.note exactly as the Index wrote it, the parser and the
 *  document text are untouched. */
const FORMERLY = /^formerly\s+(\d{3})\b[;,.]?\s*(.*)$/i;
const splitNote = (note: string) => {
  const m = FORMERLY.exec(note);
  return m ? { former: m[1], summary: m[2] } : { former: null as string | null, summary: note };
};

/** One accent per handbook group, on the card badge and the group heading — Saad asked
 *  for handbooks to read apart at a glance. Picked from Tailwind's own untouched hues:
 *  this app's red-* and slate-* are remapped to the maroon brand palette (index.css) for
 *  the 60%-maroon-dominance rule, so those two stay reserved for everything else on
 *  screen and a handbook accent never fights the brand colour. Matched by the Index's
 *  own heading text, literal Tailwind class names throughout (the JIT scans source text,
 *  not a computed `bg-${x}-700` string) — anything unrecognised falls back to the single
 *  maroon every card used before this round. */
const HANDBOOK_ACCENT: Record<string, { badge: string; text: string; ring: string }> = {
  "Team Handbook": { badge: "bg-amber-700", text: "text-amber-800", ring: "border-amber-200" },
  "Editorial Standards Handbook": { badge: "bg-indigo-700", text: "text-indigo-800", ring: "border-indigo-200" },
  "Finance and Controls Handbook": { badge: "bg-emerald-700", text: "text-emerald-800", ring: "border-emerald-200" },
  "Programmes and Funding Handbook": { badge: "bg-sky-700", text: "text-sky-800", ring: "border-sky-200" },
  "Strategy": { badge: "bg-violet-700", text: "text-violet-800", ring: "border-violet-200" },
};
const STANDALONE_ACCENT = { badge: "bg-stone-700", text: "text-stone-800", ring: "border-stone-200" };
const DEFAULT_ACCENT = { badge: "bg-[#6D1A1A]", text: "text-slate-600", ring: "border-slate-200" };
const accentFor = (heading: string, standalone?: boolean) =>
  standalone ? STANDALONE_ACCENT : HANDBOOK_ACCENT[heading] || DEFAULT_ACCENT;

/**
 * A policy chapter's body, split into headed sections for the reading view's table of
 * contents. Presentation only — the body is rendered exactly as written; this only
 * decides how consecutive LINES group (heading / bullet / numbered step / paragraph /
 * label callout), the way a person reading the raw text already does.
 *
 * A short, punctuation-free "N. Title" or "N.N Title" line is a section heading. Checked
 * against the Team, Finance and Information/Privacy handbooks before picking the length
 * + trailing-punctuation cut: a numbered PROCEDURE STEP ("3. The Executive Director or
 * the Finance Officer approves the payment, never one they raised...") starts with the
 * identical "N. " shape and would otherwise be mistaken for a heading. Strategy (P10)
 * uses bare, un-numbered headings ("Vision", "Strategic Goals") and gets no detected
 * sections at all — guessing which short lines are headings there risks false positives
 * the numbered handbooks don't have, so its body renders as plain paragraphs, same as
 * before this pass.
 *
 * Section "0" is every numbered handbook's own front matter ("0. How this policy works" —
 * identical wording checked across all five, never varies) — real content, but not a rule
 * a reader is meant to count alongside "1. Our commitments". It stays a real heading (same
 * TOC entry, same anchor) with its "0"/"0.N" number hidden rather than shown, both in the
 * body and the TOC — checked live across every handbook before deciding the title reads
 * fine alone ("How this policy works", "Scope", "Roles" — no invented text needed).
 *
 * A short standalone line with nothing after it but a bulleted or numbered list — "At a
 * glance", "Editor's note — ...", "Changed on ..." — is the SAME shape in every handbook
 * that has one (confirmed: Team, Finance, Programmes, Information/Privacy, Editorial all
 * open a chapter with "At a glance" the same way). One rule catches the family rather than
 * hardcoding "At a glance" alone, matching how it was asked: handled consistently, not
 * patched once. Rendered as a highlighted callout, not a numbered section — it never gets
 * a TOC entry, since it is not a peer of "1. Our commitments" the reader would jump to.
 */
type BodyBlock =
  | { kind: "h3"; id: string; num: string; title: string }
  | { kind: "label"; text: string }
  | { kind: "bullet" | "numbered"; text: string }
  | { kind: "p"; text: string };

const isHeadingText = (s: string) => s.length > 0 && s.length <= 70 && !/[.,;:]$/.test(s.trim());
const isLabelText = (s: string) => s.length > 0 && s.length <= 60 && !/^\d/.test(s) && !/[.,;:]$/.test(s.trim());
const isIntroNum = (num: string) => num === "0" || num.startsWith("0.");
const H2_LINE = /^(\d+)\.\s+(.+)$/;
const H3_LINE = /^(\d+\.\d+)\s+(.+)$/;
const BULLET_LINE = /^\t•\t(.+)$/;
const NUMBERED_LINE = /^\t\d+\.\t(.+)$/;

type Section = { id: string; num: string; title: string; blocks: BodyBlock[] };

/** Returns the lead (everything before the first numbered section — the approval line and
 *  "At a glance"), one Section per H2 holding everything up to the next H2, and the TOC.
 *  A chapter with no numbered sections (Strategy) is all lead, so it reads as before. */
function parseBody(body: string) {
  const lead: BodyBlock[] = [];
  const sections: Section[] = [];
  const toc: { id: string; num: string; title: string; level: 2 | 3; parent: string }[] = [];
  const push = (b: BodyBlock) => (sections.length ? sections[sections.length - 1].blocks : lead).push(b);
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const h2 = H2_LINE.exec(raw);
    if (h2 && isHeadingText(h2[2])) {
      const id = `sec-${h2[1].replace(/\./g, "-")}`;
      sections.push({ id, num: h2[1], title: h2[2], blocks: [] });
      toc.push({ id, num: h2[1], title: h2[2], level: 2, parent: id });
      continue;
    }
    const h3 = H3_LINE.exec(raw);
    if (h3 && isHeadingText(h3[2])) {
      const id = `sec-${h3[1].replace(/\./g, "-")}`;
      push({ kind: "h3", id, num: h3[1], title: h3[2] });
      toc.push({ id, num: h3[1], title: h3[2], level: 3, parent: sections.length ? sections[sections.length - 1].id : id });
      continue;
    }
    const bullet = BULLET_LINE.exec(raw);
    if (bullet) { push({ kind: "bullet", text: bullet[1] }); continue; }
    const numbered = NUMBERED_LINE.exec(raw);
    if (numbered) { push({ kind: "numbered", text: numbered[1] }); continue; }
    const next = lines[i + 1] || "";
    if (isLabelText(raw) && (BULLET_LINE.test(next) || NUMBERED_LINE.test(next))) {
      push({ kind: "label", text: raw });
      continue;
    }
    if (raw.trim()) push({ kind: "p", text: raw });
  }
  return { lead, sections, toc };
}

/** Clears the phone's sticky reading bar when a TOC jump scrolls a heading to the top. */
const JUMP_MARGIN = "scroll-mt-28 md:scroll-mt-4";

/** Renders the classified blocks, grouping consecutive bullet/numbered lines into one
 *  real <ul>/<ol> rather than a run of stray <li>s, and a "label" block together with the
 *  list it introduces into one highlighted callout. */
function renderBody(blocks: BodyBlock[]) {
  const nodes: ReactNode[] = [];
  let i = 0;
  const readList = () => {
    const kind = blocks[i].kind as "bullet" | "numbered";
    const items: string[] = [];
    while (i < blocks.length && blocks[i].kind === kind) { items.push((blocks[i] as { text: string }).text); i++; }
    return { kind, items };
  };
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.kind === "label") {
      const label = b.text;
      i++;
      const { kind, items } = i < blocks.length && (blocks[i].kind === "bullet" || blocks[i].kind === "numbered") ? readList() : { kind: "bullet" as const, items: [] };
      const Tag = kind === "numbered" ? "ol" : "ul";
      nodes.push(
        <div key={`label-${i}`} className="my-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-[13px] font-bold text-amber-900">{label}</p>
          {items.length > 0 && (
            <Tag className={`mt-2 space-y-1.5 ps-5 text-[13px] leading-relaxed text-amber-950 ${kind === "numbered" ? "list-decimal" : "list-disc"}`}>
              {items.map((it, j) => <li key={j}>{it}</li>)}
            </Tag>
          )}
        </div>
      );
      continue;
    }
    if (b.kind === "bullet" || b.kind === "numbered") {
      const { kind, items } = readList();
      const Tag = kind === "numbered" ? "ol" : "ul";
      nodes.push(
        <Tag key={`list-${i}`} className={`my-3 space-y-1.5 ps-5 text-[13px] leading-relaxed text-slate-800 ${kind === "numbered" ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => <li key={j}>{it}</li>)}
        </Tag>
      );
      continue;
    }
    if (b.kind === "h3") {
      const intro = isIntroNum(b.num);
      nodes.push(
        <h3 key={i} id={b.id} className={`mt-5 text-[15px] font-bold text-slate-800 first:mt-0 ${JUMP_MARGIN}`}>
          {intro ? b.title : <span dir="ltr"><span className="me-2 font-mono text-[13px] text-slate-400">{b.num}</span>{b.title}</span>}
        </h3>
      );
      i++; continue;
    }
    if (b.kind === "p") nodes.push(<p key={i} className="mt-3 text-[13px] leading-relaxed text-slate-800 first:mt-0">{b.text}</p>);
    i++;
  }
  return nodes;
}

type Selected = { doc: AppDoc; no: string; title: string; chapters: Chapter[] };

export default function HandbooksTab({ state, t, openDoc, openDoor, askHelp, focusId, setFocusId }: SharedProps) {
  const liveDocs = useMemo(
    () => state.documents.filter(d => d.category === "Handbook" && !isSupersededPointer(d.base64)),
    [state.documents]
  );
  const supersededDocs = useMemo(
    () => state.documents.filter(d => d.category === "Handbook" && isSupersededPointer(d.base64)),
    [state.documents]
  );
  const historyByChapter = useMemo(() => {
    const map: Record<string, AppDoc[]> = {};
    for (const d of supersededDocs) {
      const no = historyChapterOf(d);
      if (no) (map[no] ||= []).push(d);
    }
    return map;
  }, [supersededDocs]);

  const indexDoc = liveDocs.find(d => /index/i.test(d.filename));

  const [parsed, setParsed] = useState<ParsedIndex | null>(null);
  const [docText, setDocText] = useState<Record<string, string>>({});
  const [busyDoc, setBusyDoc] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  // Per-section open/closed choices; a section nobody has touched falls back to "open if
  // it is the intro (0)". Reset whenever another policy opens.
  const [openSecs, setOpenSecs] = useState<Record<string, boolean>>({});
  const [currentSec, setCurrentSec] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  const fetchText = async (doc: AppDoc) => {
    if (docText[doc.id]) return docText[doc.id];
    setBusyDoc(doc.id);
    try {
      const r = await fetch(withTicket(`/api/document/docx-text/${doc.id}`));
      const text = r.ok ? await r.text() : "";
      setDocText(prev => ({ ...prev, [doc.id]: text }));
      return text;
    } finally {
      setBusyDoc(null);
    }
  };

  useEffect(() => {
    if (!indexDoc || parsed) return;
    fetchText(indexDoc).then(text => { if (text) setParsed(parseHandbooksIndex(text)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexDoc?.id]);

  const openChapter = async (doc: AppDoc, chapters: Chapter[], no: string, title: string) => {
    setHistoryOpen(false);
    setSectionsOpen(false);
    setOpenSecs({});
    setCurrentSec(null);
    setSelected({ doc, no, title, chapters });
    await fetchText(doc);
  };

  // A citation clicked in the help desk ("Policy P5 §7.2") or a notification lands here
  // as focusId "policy:P5" — the same door-plus-focus mechanism every other tab uses.
  useEffect(() => {
    if (!focusId || !parsed) return;
    const m = /^policy:(P\d{1,2}|\d{3})$/i.exec(focusId);
    if (!m) { return; }
    const no = policyNo(m[1]);   // an old "policy:020" link still lands on P5
    const hb = parsed.handbooks.find(h => h.chapters.some(c => c.no === no));
    if (hb) {
      const doc = findHandbookDoc(hb.heading, liveDocs);
      const c = hb.chapters.find(c => c.no === no)!;
      if (doc) openChapter(doc, hb.chapters, c.no, c.title);
    } else {
      const c = parsed.standalone.find(c => c.no === no);
      const doc = c && findHandbookDoc(c.title, liveDocs);
      if (c && doc) openChapter(doc, parsed.standalone, c.no, c.title);
    }
    setFocusId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, parsed]);

  /** One policy as a big tappable card — same shape whether it sits in a handbook's
   *  group or a flat search-results list, so both read as one design. A plain function
   *  returning JSX, not a <Tag/> component: this codebase's one precedent for a custom
   *  component keyed in a .map() (ArchiveTab's Lane) has always failed tsc's "Property
   *  'key' does not exist" check — pre-existing, harmless, but no reason to add three
   *  more instances of it when key on the button itself, which has always type-checked
   *  cleanly here, does the same job. */
  const policyCard = (key: string, c: Chapter, heading: string, accent: { badge: string; text: string }, disabled: boolean, onOpen: () => void) => {
    const { former, summary } = splitNote(c.note);
    return (
      <button
        key={key}
        disabled={disabled}
        onClick={onOpen}
        className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-start shadow-sm transition-colors hover:border-red-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl font-mono text-xl font-bold text-white ${accent.badge}`}>
          {c.no}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-snug text-slate-900">{c.title}</p>
          {summary && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{summary}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
            <span>{heading}</span>
            {former && <span>· {t("formerly")} {former}</span>}
          </div>
        </div>
      </button>
    );
  };

  const indexFaults = parsed ? findIndexFaults(parsed) : [];

  const searchHits = useMemo(() => {
    if (!parsed || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const groups = [
      ...parsed.handbooks.map(h => ({ heading: h.heading, chapters: h.chapters, standalone: false })),
      { heading: t("Standing on its own"), chapters: parsed.standalone, standalone: true },
    ];
    return groups.flatMap(g => g.chapters
      .filter(c => c.no.includes(q) || c.title.toLowerCase().includes(q) || c.note.toLowerCase().includes(q))
      .map(c => ({ ...c, heading: g.heading, standalone: g.standalone })));
  }, [parsed, query, t]);

  // Only parseBody() below is a Hook (useMemo) — everything that feeds it is a plain
  // value and could live inside `if (selected)` same as before, but the memo call
  // itself cannot: selected flips between an object and null on every render, and a
  // Hook may never run conditionally (React error #310 — caught live, not guessed).
  // Called with an empty body when nothing is selected; parseBody("") is a harmless
  // no-op, so this costs nothing on every other screen.
  const selectedText = selected ? docText[selected.doc.id] || "" : "";
  const selectedAnchors = selected ? chapterAnchors(selectedText) : {};
  const selectedIsMissing = selected ? missingChapterText(selected.chapters, selectedAnchors).some(c => c.no === selected.no) : false;
  const selectedBody = selected && !selectedIsMissing ? chapterSlice(selectedText, selected.no, selectedAnchors) : "";
  const { lead, sections, toc } = useMemo(() => parseBody(selectedBody), [selectedBody]);

  // A TOC jump may target a section that is still collapsed: open it first, then scroll
  // once React has rendered it.
  useEffect(() => {
    if (!jumpTo) return;
    document.getElementById(jumpTo)?.scrollIntoView({ block: "start" });
    setJumpTo(null);
  }, [jumpTo]);

  // "Where am I": the last section header that has scrolled up past the sticky bar (or
  // the top of the content column on desktop). Scroll events don't bubble, so this
  // listens in the capture phase and catches <main>'s own scrolling. At the very bottom
  // the last section counts as reached even if its header never gets to the top.
  useEffect(() => {
    if (!sections.length) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const main = articleRef.current?.closest("main");
        if (!main) return;
        const limit = Math.max(barRef.current?.getBoundingClientRect().bottom ?? 0, main.getBoundingClientRect().top) + 24;
        let cur = sections[0].id;
        for (const s of sections) {
          const el = document.getElementById(s.id);
          if (!el || el.getBoundingClientRect().top > limit) break;
          cur = s.id;
        }
        if (main.scrollTop > 0 && main.scrollTop + main.clientHeight >= main.scrollHeight - 4) cur = sections[sections.length - 1].id;
        setCurrentSec(cur);
      });
    };
    document.addEventListener("scroll", measure, { capture: true, passive: true });
    measure();
    return () => { document.removeEventListener("scroll", measure, { capture: true }); cancelAnimationFrame(raf); };
  }, [sections]);

  if (selected) {
    const isMissing = selectedIsMissing;
    const chapterMeta = selected.chapters.find(c => c.no === selected.no);
    const doors = POLICY_DOORS[selected.no] || [];
    const history = historyByChapter[selected.no] || [];
    const selectedHeading = parsed?.handbooks.find(h => h.chapters.some(c => c.no === selected.no))?.heading;
    const accent = accentFor(selectedHeading || "", !selectedHeading);

    const isOpen = (s: Section) => openSecs[s.id] ?? isIntroNum(s.num);
    const setAll = (open: boolean) => setOpenSecs(Object.fromEntries(sections.map(s => [s.id, open])));
    const jump = (id: string, parent: string) => {
      setOpenSecs(o => ({ ...o, [parent]: true }));
      setSectionsOpen(false);
      setJumpTo(id);
    };

    // Progress counts numbered sections by position; the intro (0) reads as "Introduction".
    const numbered = sections.filter(s => !isIntroNum(s.num));
    const cur = sections.find(s => s.id === currentSec);
    const curPos = cur && !isIntroNum(cur.num) ? numbered.indexOf(cur) + 1 : 0;
    const progressLabel = curPos
      ? t("Section {n} of {m}").replace("{n}", String(curPos)).replace("{m}", String(numbered.length))
      : t("Introduction");
    const progressPct = numbered.length ? Math.round((curPos / numbered.length) * 100) : 0;

    // dir="ltr": a bare "N." immediately followed by a Latin-word title inverts under RTL —
    // measured live ("0.2" trading places with "What moved out") — so num and title are
    // isolated as one run. Section 0 has no number left to invert.
    const numTitle = (num: string, title: string, numClass: string) =>
      isIntroNum(num) ? title : <span dir="ltr"><span className={`me-2 font-mono ${numClass}`}>{num}{num.includes(".") ? "" : "."}</span>{title}</span>;

    const tocList = () => (
      <nav className="space-y-0.5">
        {toc.map(s => (
          <button key={s.id} onClick={() => jump(s.id, s.parent)}
            className={`block min-h-11 w-full rounded-md px-2 py-2 text-start text-[13px] md:min-h-0 md:py-1.5 ${
              s.level === 3 ? "ps-5 text-slate-500 hover:bg-slate-50" :
              s.id === currentSec ? "bg-slate-100 font-semibold text-slate-900" : "font-semibold text-slate-700 hover:bg-slate-50"}`}>
            {numTitle(s.num, s.title, "text-slate-400")}
          </button>
        ))}
      </nav>
    );

    const backLabel = t("Back to Policies & handbooks");

    return (
      <div className="space-y-5">
        {/* Phone: one sticky bar keeps "back", the section list and the reader's place
            within reach however far down a long policy they are. Bleeds over <main>'s
            p-4 so it spans the screen. */}
        <div ref={barRef} className="sticky -top-4 z-20 -mx-4 -mt-4 border-b border-slate-200 bg-white/95 px-2 backdrop-blur md:hidden">
          <div className="flex items-center gap-1">
            <button onClick={() => setSelected(null)} aria-label={backLabel} title={backLabel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
              <ArrowRight className="h-5 w-5 rotate-180 rtl:rotate-0" />
            </button>
            {sections.length > 0 ? (
              <button onClick={() => setSectionsOpen(o => !o)} aria-expanded={sectionsOpen}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-start">
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-slate-500">{progressLabel}</span>
                  <span className="block truncate text-[13px] font-bold text-slate-800">{cur ? cur.title : selected.title}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${sectionsOpen ? "rotate-180" : ""}`} />
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800">{selected.title}</span>
            )}
          </div>
          {sections.length > 0 && (
            <div className="-mx-2 h-1 bg-slate-100" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={progressLabel}>
              <div className={`h-full transition-[width] duration-300 ${accent.badge}`} style={{ width: `${progressPct}%` }} />
            </div>
          )}
          {sectionsOpen && <div className="max-h-[60vh] overflow-y-auto py-2">{tocList()}</div>}
        </div>

        <button onClick={() => setSelected(null)}
          className="hidden items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 md:inline-flex">
          <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" /> {backLabel}
        </button>

        <div className={`border-s-4 ps-4 ${accent.ring}`}>
          <p className={`text-xs font-mono font-bold uppercase tracking-wider ${accent.text}`}>
            {selectedHeading || t("Standing on its own")} · {t("Policy")} {selected.no}
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-slate-900">{selected.title}</h1>
        </div>

        {doors.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-500">{t("Enforced at")}:</span>
            {doors.map(d => (
              <button key={d} onClick={() => openDoor(d)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-200">
                {t(doorLabel(d))} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </button>
            ))}
          </div>
        )}

        <button onClick={() => askHelp(`${t("Policy")} ${selected.no} — ${selected.title}`)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#6D1A1A] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#4A1010]">
          {ic(MessageCircleQuestion, "h-3.5 w-3.5")} {t("Ask about this policy")}
        </button>

        {/* Desktop keeps a sticky section column beside the text; the phone has the
            sticky bar above. Each numbered section is an accordion — the lead (approval
            line, "At a glance") and the intro (0) start open, the rules start folded so
            a reader sees the whole policy's shape before its detail. */}
        <div ref={articleRef} className={sections.length > 0 ? "md:grid md:grid-cols-[1fr_15rem] md:items-start md:gap-8" : ""}>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
            {busyDoc === selected.doc.id ? (
              <p className="text-sm text-slate-500">{t("Reading the handbook…")}</p>
            ) : isMissing ? (
              <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">
                {ic(AlertTriangle, "h-4 w-4 shrink-0 mt-0.5")}
                <p>{t("The Index lists this chapter here, but the handbook's own text does not carry it yet.")}{chapterMeta?.note ? ` ${chapterMeta.note}.` : ""}</p>
              </div>
            ) : (
              <div className="mx-auto max-w-[70ch]">
                {renderBody(lead)}
                {sections.length > 0 && (
                  <div className="mt-4 flex justify-end gap-1 border-b border-slate-100 pb-1">
                    <button onClick={() => setAll(true)} className="min-h-11 rounded-lg px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-100">{t("Expand all")}</button>
                    <button onClick={() => setAll(false)} className="min-h-11 rounded-lg px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-100">{t("Collapse all")}</button>
                  </div>
                )}
                {sections.map(s => {
                  const open = isOpen(s);
                  return (
                    <section key={s.id} className="border-b border-slate-100 last:border-0">
                      <h2 id={s.id} className={JUMP_MARGIN}>
                        <button onClick={() => setOpenSecs(o => ({ ...o, [s.id]: !open }))}
                          aria-expanded={open} aria-controls={`${s.id}-body`}
                          className="flex min-h-11 w-full items-center gap-3 py-3 text-start hover:bg-slate-50/60">
                          <span className={`min-w-0 flex-1 text-lg font-bold leading-snug ${isIntroNum(s.num) ? "text-slate-800" : accent.text}`}>
                            {numTitle(s.num, s.title, "text-base text-slate-400")}
                          </span>
                          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                      </h2>
                      {open && <div id={`${s.id}-body`} className="pb-5">{renderBody(s.blocks)}</div>}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
          {sections.length > 0 && (
            <div className="sticky top-4 mt-6 hidden max-h-[75vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 md:mt-0 md:block">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("Sections")}</p>
              {tocList()}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <button onClick={() => setHistoryOpen(o => !o)}
              className="flex w-full items-center gap-2 p-3 text-start text-[12px] font-bold text-slate-600">
              {ic(HistoryIcon, "h-4 w-4")} {t("History")} ({history.length})
              {historyOpen ? <ChevronDown className="h-4 w-4 ms-auto" /> : <ChevronRight className="h-4 w-4 ms-auto rtl:rotate-180" />}
            </button>
            {historyOpen && (
              <div className="space-y-2 border-t border-slate-100 p-3">
                {history.map(d => (
                  <button key={d.id} onClick={() => openDoc(d)}
                    className="block w-full text-start rounded-lg p-2 hover:bg-slate-50">
                    <p className="text-[12px] font-semibold text-slate-700">{policyHeading(d.filename)}</p>
                    <p className="text-[11px] text-slate-500">{d.note}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t("Policies & handbooks")}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {t("AnaHon's institutional policies — the five documents that carry them, and Policy P11, which stands on its own.")}
        </p>
      </div>

      {indexFaults.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
          {ic(AlertTriangle, "h-4 w-4 shrink-0 mt-0.5")}
          <div>{indexFaults.map((f, i) => <p key={i}>{f}</p>)}</div>
        </div>
      )}

      <div className="relative max-w-md">
        <span className="absolute inset-y-0 start-3 flex items-center text-slate-400">{ic(Search, "h-4 w-4")}</span>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t("Find a policy by number, title or word…")}
          className="w-full rounded-lg border border-slate-300 py-2 ps-9 pe-3 text-sm outline-none focus:border-[#6D1A1A]" />
      </div>

      {query.trim() ? (
        <div className="space-y-3">
          {searchHits.length === 0 && <p className="text-sm text-slate-500">{t("No policy matches that.")}</p>}
          {searchHits.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {searchHits.map(c => {
                const doc = c.standalone ? findHandbookDoc(c.title, liveDocs) : findHandbookDoc(c.heading, liveDocs);
                const chapters = c.standalone ? parsed!.standalone : parsed!.handbooks.find(h => h.heading === c.heading)!.chapters;
                return (
                  policyCard(`${c.heading}-${c.no}`, c, c.heading, accentFor(c.heading, c.standalone), !doc,
                    () => { if (doc) openChapter(doc, chapters, c.no, c.title); })
                );
              })}
            </div>
          )}
        </div>
      ) : !parsed ? (
        <p className="text-sm text-slate-500">{t("Reading the Index…")}</p>
      ) : (
        <div className="space-y-10">
          {parsed.handbooks.map(h => {
            const doc = findHandbookDoc(h.heading, liveDocs);
            const accent = accentFor(h.heading);
            return (
              <div key={h.heading}>
                <h3 className={`flex items-center gap-2 text-base font-bold uppercase tracking-wider ${accent.text}`}>
                  {ic(BookOpen, "h-5 w-5")} {h.heading}
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {h.chapters.map(c => (
                    policyCard(c.no, c, h.heading, accent, !doc,
                      () => { if (doc) openChapter(doc, h.chapters, c.no, c.title); })
                  ))}
                </div>
              </div>
            );
          })}

          {parsed.standalone.length > 0 && (
            <div>
              <h3 className={`flex items-center gap-2 text-base font-bold uppercase tracking-wider ${STANDALONE_ACCENT.text}`}>
                {ic(BookOpen, "h-5 w-5")} {t("Standing on its own")}
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {parsed.standalone.map(c => {
                  const doc = findHandbookDoc(c.title, liveDocs);
                  return (
                    policyCard(c.no, c, t("Standing on its own"), STANDALONE_ACCENT, !doc,
                      () => { if (doc) openChapter(doc, parsed.standalone, c.no, c.title); })
                  );
                })}
              </div>
            </div>
          )}

          {parsed.stillToSettle.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold text-slate-500">{t("Still to settle")}</p>
              <ul className="mt-1 space-y-1 text-[11.5px] text-slate-500 list-disc ps-4">
                {parsed.stillToSettle.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
