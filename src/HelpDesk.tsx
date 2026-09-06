import { useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, X, CornerDownLeft, ArrowRight } from "lucide-react";

/**
 * The floating question box, on every screen.
 *
 * It answers from the system's own writing — the Q&A, the desk rules, the door list and
 * the table that decides who may call what — for the role the asker is in right now. Two
 * things it deliberately does not do: it does not guess when the material is silent (it
 * says so and names the seat to ask), and it does not describe where to go. When the
 * answer has a door, the reply carries a button that opens it.
 */
type Reply = { answer: string; door: string | null; askSeat: string | null };
type Turn = { q: string; reply?: Reply; error?: string };

export default function HelpDesk({
  t, lang, rtl, doorLabel, onOpenDoor,
}: {
  t: (s: string) => string;
  lang: string;
  rtl: boolean;
  doorLabel: (navKey: string) => string;
  onOpenDoor: (navKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setTurns(prev => [...prev, { q: question }]);
    setBusy(true);
    try {
      const r = await fetch("/api/help/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("The help desk could not answer just now."));
      setTurns(prev => prev.map((x, i) => (i === prev.length - 1 ? { ...x, reply: d as Reply } : x)));
    } catch (e: any) {
      setTurns(prev => prev.map((x, i) => (i === prev.length - 1 ? { ...x, error: e.message } : x)));
    } finally {
      setBusy(false);
    }
  };

  // The widget is fixed, so without an offset it sat on top of the sidebar and covered
  // the bottom of the navigation. It docks to --dock-start, published on the app root:
  // the content's own left edge, 18rem with the sidebar open and 2rem collapsed. So it
  // follows the sidebar both ways, over the same 300ms, without being told its state.
  // Resting: the same raise the door tiles use, so it reads as part of the system.
  // z-[95] puts it beside the "N missing" pill and under that drawer's backdrop
  // (z-[96]) — at 96 it floated on top of the dim.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={t("Ask for help")}
        aria-label={t("Ask for help")}
        className="fixed bottom-5 start-5 z-[95] flex h-12 w-12 md:start-[var(--dock-start)] items-center justify-center rounded-full bg-[#6D1A1A] text-white shadow-lg shadow-[#6D1A1A]/25 duration-300 ease-in-out transition-[background-color,box-shadow,transform,inset-inline-start] hover:-translate-y-0.5 hover:bg-[#4A1010] hover:shadow-xl hover:shadow-[#6D1A1A]/30"
      >
        <MessageCircleQuestion className="h-5 w-5" />
      </button>
    );
  }

  // Open: the panel is 335px wide on a phone and the "N missing" pill sits in the
  // opposite bottom corner — measured, the panel covered it whole (106x36) and the pill
  // could not be clicked. The overlap exists on any viewport under 498px, so the panel
  // lifts clear until `lg` and drops back to the launcher's corner above it. Height is
  // not fixed (Arabic wraps differently), so this raises the bottom, never the top.
  // `lg` and not `sm`: from `md` the panel starts at the content edge (288px), which at
  // 768-771px puts its right edge back under the pill. Measured, not guessed.
  return (
    <div
      ref={boxRef}
      dir={rtl ? "rtl" : "ltr"}
      className="fixed bottom-24 start-5 z-[95] flex max-h-[70vh] md:start-[var(--dock-start)] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[#E6D3CA] bg-white shadow-2xl shadow-[#4A1010]/20 duration-300 ease-in-out transition-[inset-inline-start] lg:bottom-5"
    >
      <div className="flex items-center justify-between gap-2 bg-[#6D1A1A] ps-3 pe-1.5 py-1.5 text-white">
        <p className="flex items-center gap-2 text-xs font-bold">
          <MessageCircleQuestion className="h-4 w-4" /> {t("Ask for help")}
        </p>
        <button onClick={() => setOpen(false)} aria-label={t("Close")} className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-white/15">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!turns.length && (
          <p className="text-[12px] leading-relaxed text-slate-500">
            {t("Ask how something works, where to find it, whether you are allowed to do it, or what a row on your desk means.")}
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="space-y-1.5">
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl bg-[#F88888]/20 px-3 py-1.5 text-[13px] leading-relaxed text-slate-900">{turn.q}</p>
            {turn.error ? (
              <p className="w-fit max-w-[95%] rounded-2xl bg-red-50 px-3 py-1.5 text-[13px] leading-relaxed text-red-800">{turn.error}</p>
            ) : turn.reply ? (
              <div className="w-fit max-w-[95%] space-y-1.5 rounded-2xl bg-slate-100 px-3 py-2">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{turn.reply.answer}</p>
                {turn.reply.door && (
                  <button
                    onClick={() => { onOpenDoor(turn.reply!.door!); setOpen(false); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#6D1A1A] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#4A1010]"
                  >
                    {t("Open")} {doorLabel(turn.reply.door)} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </button>
                )}
                {turn.reply.askSeat && (
                  <p className="text-[11px] text-slate-600">{t("Ask")}: {t(turn.reply.askSeat)}</p>
                )}
              </div>
            ) : (
              <p className="w-fit rounded-2xl bg-slate-100 px-3 py-1.5 text-[13px] text-slate-600">{t("Reading the handbook…")}</p>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-slate-200 p-2">
        <textarea
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          rows={2}
          placeholder={t("How do I…?")}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none transition-colors focus:border-[#6D1A1A]"
        />
        <button
          onClick={ask}
          disabled={busy || !q.trim()}
          aria-label={t("Send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#6D1A1A] text-white transition-colors hover:bg-[#4A1010] disabled:opacity-40"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
