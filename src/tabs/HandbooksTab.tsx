import { useEffect, useMemo, useState } from "react";
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

/** "formerly 020; merged with 003, approved 15 Sep 2026: accounts, ..." — the Index
 *  always states the old number first. Whatever follows becomes the one-line summary;
 *  a chapter with nothing past "formerly NNN" (Policy P4) shows no summary line rather
 *  than an invented one. Presentation only: reads c.note exactly as the Index wrote it,
 *  the parser and the document text are untouched. */
const FORMERLY = /^formerly\s+(\d{3})\b[;,.]?\s*(.*)$/i;
const splitNote = (note: string) => {
  const m = FORMERLY.exec(note);
  return m ? { former: m[1], summary: m[2] } : { former: null as string | null, summary: note };
};

/** One policy as a big tappable card — the same shape whether it sits in a handbook's
 *  group or in a flat search-results list, so both read as one design. */
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
  const policyCard = (key: string, c: Chapter, heading: string, disabled: boolean, onOpen: () => void) => {
    const { former, summary } = splitNote(c.note);
    return (
      <button
        key={key}
        disabled={disabled}
        onClick={onOpen}
        className="flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-start shadow-sm transition-colors hover:border-red-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#6D1A1A] font-mono text-lg font-bold text-white">
          {c.no}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-snug text-slate-900">{c.title}</p>
          {summary && <p className="mt-1 line-clamp-1 text-sm text-slate-600">{summary}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
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

  if (selected) {
    const text = docText[selected.doc.id] || "";
    const anchors = chapterAnchors(text);
    const missing = missingChapterText(selected.chapters, anchors);
    const isMissing = missing.some(c => c.no === selected.no);
    const body = isMissing ? "" : chapterSlice(text, selected.no, anchors);
    const chapterMeta = selected.chapters.find(c => c.no === selected.no);
    const doors = POLICY_DOORS[selected.no] || [];
    const history = historyByChapter[selected.no] || [];

    return (
      <div className="space-y-5">
        <button onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" /> {t("Back to Policies & handbooks")}
        </button>

        <div>
          <p className="text-xs font-mono text-slate-400">{t("Policy")} {selected.no}</p>
          <h2 className="text-2xl font-bold text-slate-900">{selected.title}</h2>
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

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {busyDoc === selected.doc.id ? (
            <p className="text-sm text-slate-500">{t("Reading the handbook…")}</p>
          ) : isMissing ? (
            <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">
              {ic(AlertTriangle, "h-4 w-4 shrink-0 mt-0.5")}
              <p>{t("The Index lists this chapter here, but the handbook's own text does not carry it yet.")}{chapterMeta?.note ? ` ${chapterMeta.note}.` : ""}</p>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{body}</p>
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {searchHits.map(c => {
                const doc = c.standalone ? findHandbookDoc(c.title, liveDocs) : findHandbookDoc(c.heading, liveDocs);
                const chapters = c.standalone ? parsed!.standalone : parsed!.handbooks.find(h => h.heading === c.heading)!.chapters;
                return (
                  policyCard(`${c.heading}-${c.no}`, c, c.heading, !doc,
                    () => { if (doc) openChapter(doc, chapters, c.no, c.title); })
                );
              })}
            </div>
          )}
        </div>
      ) : !parsed ? (
        <p className="text-sm text-slate-500">{t("Reading the Index…")}</p>
      ) : (
        <div className="space-y-8">
          {parsed.handbooks.map(h => {
            const doc = findHandbookDoc(h.heading, liveDocs);
            return (
              <div key={h.heading}>
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                  {ic(BookOpen, "h-4 w-4")} {h.heading}
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {h.chapters.map(c => (
                    policyCard(c.no, c, h.heading, !doc,
                      () => { if (doc) openChapter(doc, h.chapters, c.no, c.title); })
                  ))}
                </div>
              </div>
            );
          })}

          {parsed.standalone.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                {ic(BookOpen, "h-4 w-4")} {t("Standing on its own")}
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {parsed.standalone.map(c => {
                  const doc = findHandbookDoc(c.title, liveDocs);
                  return (
                    policyCard(c.no, c, t("Standing on its own"), !doc,
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
