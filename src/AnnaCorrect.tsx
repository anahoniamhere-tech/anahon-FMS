import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Play, Check, ChevronLeft, ChevronRight } from "lucide-react";

/* Saad's test-set correction screen (drafts/anna-learns-arabic-plan.md §B2). The first 15 minutes
   of each transcribed podcast: play one line, fix Deepgram's Arabic beside it, save. No technical
   skill needed — reads/writes plain SRT files on the NAS through /api/anna/train, never the
   Deepgram originals. */

type Line = { i: number; start: number; end: number; text: string; corrected: boolean };
type Episode = { id: string; label: string; lines: number; done: number };

const call = async (path: string, body?: unknown) => {
  const r = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d;
};

export default function AnnaCorrect({ onClose, t, lang }: { onClose: () => void; t: (s: string) => string; lang: string }) {
  const ar = lang === "ar";
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [id, setId] = useState("");
  const [lines, setLines] = useState<Line[] | null>(null);
  const [line, setLine] = useState(0);
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    call("/api/anna/train").then((d: { episodes: Episode[] }) => {
      setEpisodes(d.episodes);
      const next = d.episodes.find(e => e.done < e.lines) || d.episodes[0];
      if (next) setId(next.id);
    }).catch(e => setErr(e.message));
    call("/api/document/ticket").then(d => setTicket(d.t)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLines(null);
    call(`/api/anna/train/${id}/lines`).then((d: { lines: Line[] }) => {
      setLines(d.lines);
      const next = d.lines.findIndex(l => !l.corrected);
      setLine(next < 0 ? 0 : next);
    }).catch(e => setErr(e.message));
  }, [id]);

  const cur = lines?.[line];
  useEffect(() => { setText(cur?.text || ""); }, [cur?.i]);

  const play = () => {
    const a = audioRef.current;
    if (!a || !cur) return;
    a.currentTime = cur.start;
    void a.play();
    const stop = () => { if (a.currentTime >= cur.end) { a.pause(); a.removeEventListener("timeupdate", stop); } };
    a.addEventListener("timeupdate", stop);
  };

  const save = async () => {
    if (!cur) return;
    setSaving(true); setErr("");
    try {
      await call("/api/anna/train/save", { episode: id, i: cur.i, text });
      const fresh = await call(`/api/anna/train/${id}/lines`) as { lines: Line[] };
      setLines(fresh.lines);
      const next = fresh.lines.findIndex(l => !l.corrected);
      setLine(next < 0 ? Math.min(line + 1, fresh.lines.length - 1) : next);
      const eps = await call("/api/anna/train") as { episodes: Episode[] };
      setEpisodes(eps.episodes);
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const ep = episodes?.find(e => e.id === id);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("Correct Anna's Arabic")} dir={ar ? "rtl" : "ltr"} className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center justify-between gap-2 bg-[#6D1A1A] px-3 py-2 text-white">
        <p className="text-sm font-bold">{t("Correct Anna's Arabic")}</p>
        <button onClick={onClose} aria-label={t("Close")} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/15"><X className="h-5 w-5" /></button>
      </div>
      {!episodes ? <p className="p-4 text-sm text-slate-600">{err || t("Loading…")}</p> : (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex gap-2 overflow-x-auto pb-1 text-[12px] text-slate-600">
            {episodes.map(e => (
              <button key={e.id} onClick={() => setId(e.id)}
                className={`min-h-[36px] shrink-0 rounded-lg px-3 font-bold ${e.id === id ? "bg-[#6D1A1A] text-white" : "border border-slate-300"}`}>
                {t(e.label)} · <bdi dir="ltr">{e.done}/{e.lines}</bdi>
              </button>
            ))}
          </div>
          {!lines || !cur ? <p className="text-sm text-slate-600">{t("Loading…")}</p> : (<>
            <audio ref={audioRef} src={`/api/anna/train-audio/${id}?t=${ticket}`} preload="none" />
            <div className="flex items-center justify-between text-[12px] text-slate-500">
              <button onClick={() => setLine(l => Math.max(0, l - 1))} disabled={line === 0} aria-label={t("Previous line")}
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
              <span>{t("Line")} <bdi dir="ltr">{line + 1} / {lines.length}</bdi>{cur.corrected ? ` · ${t("corrected")} ✓` : ""} · {ep && <bdi dir="ltr">{ep.done}/{ep.lines}</bdi>}</span>
              <button onClick={() => setLine(l => Math.min(lines.length - 1, l + 1))} disabled={line === lines.length - 1} aria-label={t("Next line")}
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-5 w-5 rtl:rotate-180" /></button>
            </div>
            <button onClick={play} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#6D1A1A] text-white shadow-lg" aria-label={t("Play this line")}>
              <Play className="h-6 w-6" />
            </button>
            <textarea dir="rtl" value={text} onChange={e => setText(e.target.value)} rows={4}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-[18px] leading-relaxed text-slate-900" />
            <button onClick={save} disabled={saving || text === cur.text}
              className="mx-auto flex h-12 min-w-[9rem] items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-40">
              <Check className="h-5 w-5" /> {saving ? t("Saving…") : t("Save and next")}
            </button>
            {err && <p className="text-center text-sm text-red-700">{err}</p>}
          </>)}
        </div>
      )}
    </div>,
    document.body,
  );
}
