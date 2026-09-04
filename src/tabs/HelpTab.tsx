import React, { useMemo, useState } from "react";
import { SharedProps } from "./shared";
import { HELP, HelpEntry } from "../help";

/**
 * Help & Q&A — every explanation in the system on one page, searchable.
 *
 * The entries are the same ones behind the ⓘ marks next to buttons. Anyone with a
 * login sees this page; nothing here changes data.
 */
const AREAS: HelpEntry["area"][] = ["Seats & approvals", "Money", "Buying", "Editorial", "Website", "People", "Records"];
const AREA_AR: Record<HelpEntry["area"], string> = {
  "Seats & approvals": "المقاعد والموافقات", Money: "المال", Buying: "المشتريات", Editorial: "التحرير", Website: "الموقع", People: "الأشخاص", Records: "السجلات",
};

export default function HelpTab({ lang, t }: SharedProps) {
  const L = lang === "ar" ? "ar" : "en";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return HELP;
    return HELP.filter(h => [h.q.en, h.q.ar, h.a.en, h.a.ar, h.id].some(x => x.toLowerCase().includes(needle)));
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl space-y-6" dir={L === "ar" ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{L === "ar" ? "المساعدة والأسئلة" : "Help & Q&A"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {L === "ar"
            ? "كل شرح في النظام في صفحة واحدة. علامة ⓘ بجانب أي زر تعرض الإجابة نفسها."
            : "Every explanation in the system, on one page. The ⓘ beside a button shows the same answer."}
        </p>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder={L === "ar" ? "ابحث عن سؤال…" : "Search a question…"}
          className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none"
        />
      </div>

      {AREAS.map(area => {
        const rows = hits.filter(h => h.area === area);
        if (!rows.length) return null;
        return (
          <section key={area}>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{L === "ar" ? AREA_AR[area] : area}</h2>
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {rows.map(h => (
                <div key={h.id} id={`help-${h.id}`}>
                  <button
                    onClick={() => setOpen(open === h.id ? null : h.id)}
                    aria-expanded={open === h.id}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <span>{h.q[L]}</span>
                    <span className="text-slate-400">{open === h.id ? "−" : "+"}</span>
                  </button>
                  {open === h.id && <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{h.a[L]}</p>}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {!hits.length && (
        <p className="text-sm text-slate-500">
          {L === "ar" ? "لا شيء يطابق بحثك. أرسل السؤال إلى سعد وسيُضاف هنا." : "Nothing matches. Send the question to Saad and it will be added here."}
        </p>
      )}
      <p className="text-xs text-slate-400">
        {L === "ar" ? `${HELP.length} إجابة` : `${HELP.length} answers`} · {t("Executive Director")}: saad@anahon.org
      </p>
    </div>
  );
}
