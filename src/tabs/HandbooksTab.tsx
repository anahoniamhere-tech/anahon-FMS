import { useEffect, useMemo, useState, type ReactNode } from "react";
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
 * decides how consecutive LINES group (heading / bullet / numbered step / paragraph),
 * the way a person reading the raw text already does.
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
 */
type BodyBlock =
  | { kind: "h2" | "h3"; id: string; num: string; title: string }
  | { kind: "bullet" | "numbered"; text: string }
  | { kind: "p"; text: string };

const isHeadingText = (s: string) => s.length > 0 && s.length <= 70 && !/[.,;:]$/.test(s.trim());
const H2_LINE = /^(\d+)\.\s+(.+)$/;
const H3_LINE = /^(\d+\.\d+)\s+(.+)$/;
const BULLET_LINE = /^\t•\t(.+)$/;
const NUMBERED_LINE = /^\t\d+\.\t(.+)$/;

function parseBody(body: string) {
  const blocks: BodyBlock[] = [];
  const toc: { id: string; num: string; title: string; level: 2 | 3 }[] = [];
  for (const raw of body.split("\n")) {
    const h2 = H2_LINE.exec(raw);
    if (h2 && isHeadingText(h2[2])) {
      const id = `sec-${h2[1].replace(/\./g, "-")}`;
      blocks.push({ kind: "h2", id, num: h2[1], title: h2[2] });
      toc.push({ id, num: h2[1], title: h2[2], level: 2 });
      continue;
    }
    const h3 = H3_LINE.exec(raw);
    if (h3 && isHeadingText(h3[2])) {
      const id = `sec-${h3[1].replace(/\./g, "-")}`;
      blocks.push({ kind: "h3", id, num: h3[1], title: h3[2] });
      toc.push({ id, num: h3[1], title: h3[2], level: 3 });
      continue;
    }
    const bullet = BULLET_LINE.exec(raw);
    if (bullet) { blocks.push({ kind: "bullet", text: bullet[1] }); continue; }
    const numbered = NUMBERED_LINE.exec(raw);
    if (numbered) { blocks.push({ kind: "numbered", text: numbered[1] }); continue; }
    if (raw.trim()) blocks.push({ kind: "p", text: raw });
  }
  return { blocks, toc };
}

/** Renders the classified blocks, grouping consecutive bullet/numbered lines into one
 *  real <ul>/<ol> rather than a run of stray <li>s. accentText colours only the H2s, a
 *  light touch rather than repainting every line of a document meant to be read. */
function renderBody(blocks: BodyBlock[], accentText: string) {
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.kind === "bullet" || b.kind === "numbered") {
      const isOrdered = b.kind === "numbered";
      const items: string[] = [];
      while (i < blocks.length && blocks[i].kind === b.kind) { items.push((blocks[i] as { text: string }).text); i++; }
      const Tag = isOrdered ? "ol" : "ul";
      nodes.push(
        <Tag key={`list-${i}`} className={`my-3 space-y-1.5 ps-5 text-[13px] leading-relaxed text-slate-800 ${isOrdered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => <li key={j}>{it}</li>)}
        </Tag>
      );
      continue;
    }
    if (b.kind === "h2") {
      nodes.push(
        <h2 key={i} id={b.id} className={`mt-8 scroll-mt-4 border-b border-slate-100 pb-2 text-xl font-bold first:mt-0 ${accentText}`}>
          {/* dir="ltr": a bare "N." immediately followed by a Latin-word title inverts
              under RTL — measured live, this exact shape ("0.2" trading places with
              "What moved out") — so num and title are isolated as one run, same as the
              app's other digit-leading headings. */}
          <span dir="ltr"><span className="me-2 font-mono text-base text-slate-400">{b.num}.</span>{b.title}</span>
        </h2>
      );
      i++; continue;
    }
    if (b.kind === "h3") {
      nodes.push(
        <h3 key={i} id={b.id} className="mt-5 scroll-mt-4 text-[15px] font-bold text-slate-800">
          <span dir="ltr"><span className="me-2 font-mono text-[13px] text-slate-400">{b.num}</span>{b.title}</span>
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
  const { blocks, toc } = useMemo(() => parseBody(selectedBody), [selectedBody]);

  if (selected) {
    const isMissing = selectedIsMissing;
    const chapterMeta = selected.chapters.find(c => c.no === selected.no);
    const doors = POLICY_DOORS[selected.no] || [];
    const history = historyByChapter[selected.no] || [];
    const selectedHeading = parsed?.handbooks.find(h => h.chapters.some(c => c.no === selected.no))?.heading;
    const accent = accentFor(selectedHeading || "", !selectedHeading);

    const tocList = (onJump?: () => void) => (
      <nav className="space-y-0.5">
        {toc.map(s => (
          <a key={s.id} href={`#${s.id}`} onClick={onJump}
            className={`block rounded-md px-2 py-1.5 text-[13px] hover:bg-slate-50 ${s.level === 3 ? "ps-5 text-slate-500" : "font-semibold text-slate-700"}`}>
            <span dir="ltr">{s.num} {s.title}</span>
          </a>
        ))}
      </nav>
    );

    return (
      <div className="space-y-5">
        <button onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" /> {t("Back to Policies & handbooks")}
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

        {/* Sections: a phone gets a collapsible toggle, since a fixed sidebar would eat
            too much of a narrow screen; desktop gets a real sticky column beside the
            text, so the reader's place in a long policy is never more than a glance
            away. Plain <a href="#id"> anchors — no scroll-handler JS needed, and they
            work the same under RTL. */}
        {toc.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white md:hidden">
            <button onClick={() => setSectionsOpen(o => !o)}
              className="flex w-full items-center gap-2 p-3 text-start text-[13px] font-bold text-slate-700">
              {t("Sections")} ({toc.length})
              {sectionsOpen ? <ChevronDown className="h-4 w-4 ms-auto" /> : <ChevronRight className="h-4 w-4 ms-auto rtl:rotate-180" />}
            </button>
            {sectionsOpen && <div className="border-t border-slate-100 p-3">{tocList(() => setSectionsOpen(false))}</div>}
          </div>
        )}

        <div className={toc.length > 0 ? "md:grid md:grid-cols-[1fr_15rem] md:items-start md:gap-8" : ""}>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
            {busyDoc === selected.doc.id ? (
              <p className="text-sm text-slate-500">{t("Reading the handbook…")}</p>
            ) : isMissing ? (
              <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">
                {ic(AlertTriangle, "h-4 w-4 shrink-0 mt-0.5")}
                <p>{t("The Index lists this chapter here, but the handbook's own text does not carry it yet.")}{chapterMeta?.note ? ` ${chapterMeta.note}.` : ""}</p>
              </div>
            ) : (
              <div className="mx-auto max-w-[70ch]">{renderBody(blocks, accent.text)}</div>
            )}
          </div>
          {toc.length > 0 && (
            <nav className="sticky top-4 mt-6 hidden max-h-[75vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 md:mt-0 md:block">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("Sections")}</p>
              {tocList()}
            </nav>
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
