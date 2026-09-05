import React, { useEffect, useRef, useState } from "react";
import { helpById } from "./help";

/**
 * The small ⓘ beside a button that needs a sentence.
 *
 * Click or focus it and the answer from help.ts appears; click anywhere else, press
 * Escape, or move on and it goes. The text is the same one the Help & Q&A page shows
 * for that id, so there is exactly one explanation per feature.
 */
export default function Info({ id, lang = "en", className = "" }: { id: string; lang?: string; className?: string }) {
  const entry = helpById(id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!entry) return null;
  const L = lang === "ar" ? "ar" : "en";
  return (
    <span ref={ref} className={`relative inline-block align-middle ${className}`}>
      <button
        type="button"
        aria-label={entry.q[L]}
        aria-expanded={open}
        title={entry.q[L]}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="ms-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold leading-none text-slate-500 hover:border-red-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
      >i</button>
      {open && (
        <span
          role="dialog"
          dir={L === "ar" ? "rtl" : "ltr"}
          className="absolute start-0 top-6 z-50 block w-72 rounded-md border border-slate-200 bg-white p-3 text-start text-xs font-normal normal-case leading-relaxed text-slate-700 shadow-xl"
        >
          <span className="mb-1 block font-semibold text-slate-900">{entry.q[L]}</span>
          <span className="block">{entry.a[L]}</span>
        </span>
      )}
    </span>
  );
}
