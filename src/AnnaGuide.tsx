import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Anna's walkthrough (stage E; src/anna.ts `guide`). Opens the door, then rings one part of the
 * screen at a time — a `[data-anna-target]` element — with her words in a card, Next and Back.
 * It only looks and points: the ring lets every click through to the page, and nothing here
 * presses, types or submits (scripts/check-anna.ts reads this file to keep it that way).
 */
export type Guide = { door: string; steps: { target: string; text: string }[] };

const FIND_MS = 3000;   // a screen may still be rendering when the door opens

export default function AnnaGuide({ guide, t, rtl, onOpenDoor, onDone }: {
  guide: Guide;
  t: (s: string) => string;
  rtl: boolean;
  onOpenDoor: (navKey: string) => void;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  const step = guide.steps[i];
  const last = i === guide.steps.length - 1;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onOpenDoor(guide.door); }, [guide]);

  useEffect(() => {
    setRect(null); setMissing(false);
    const started = performance.now();
    let el: Element | null = null, scrolled = false;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Polled, not observed: the part can appear late, and the page scrolls and resizes under it.
    const tick = setInterval(() => {
      el = el?.isConnected ? el : document.querySelector(`[data-anna-target="${CSS.escape(step.target)}"]`);
      if (!el) {
        if (performance.now() - started > FIND_MS) { setMissing(true); clearInterval(tick); }
        return;
      }
      if (!scrolled) { el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" }); scrolled = true; }
      setRect(el.getBoundingClientRect());
    }, 150);
    return () => clearInterval(tick);
  }, [step.target]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onDone]);

  // The card sits in the half of the screen the ring is not in.
  const low = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;
  const pad = 6;
  return (
    <>
      {rect && (
        <div aria-hidden data-anna-ring
          className="pointer-events-none fixed z-[90] rounded-xl ring-4 ring-[#F88888] shadow-[0_0_0_9999px_rgba(15,23,42,0.25)] transition-all duration-200 motion-reduce:transition-none"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad }} />
      )}
      <div role="dialog" aria-label={t("Anna's walkthrough")} dir={rtl ? "rtl" : "ltr"}
        className={`fixed inset-x-3 z-[90] mx-auto max-w-sm rounded-2xl border border-[#E6D3CA] bg-white p-3 shadow-2xl shadow-[#4A1010]/20 ${low ? "top-3" : "bottom-24"}`}>
        <div className="flex items-start gap-2">
          <p className="flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">
            {step.text}
            {missing && <span className="mt-1 block text-[11px] text-slate-500">{t("That part is not on your screen right now.")}</span>}
          </p>
          <button onClick={onDone} aria-label={t("Close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span dir="ltr" className="flex-1 text-[11px] text-slate-400">{i + 1} / {guide.steps.length}</span>
          <button onClick={() => setI(n => n - 1)} disabled={!i}
            className="min-h-[36px] rounded-lg px-3 text-[12px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30">
            {t("Back")}
          </button>
          <button onClick={() => (last ? onDone() : setI(n => n + 1))} autoFocus
            className="min-h-[36px] rounded-lg bg-[#6D1A1A] px-4 text-[12px] font-bold text-white hover:bg-[#4A1010]">
            {last ? t("Done") : t("Next")}
          </button>
        </div>
      </div>
    </>
  );
}
