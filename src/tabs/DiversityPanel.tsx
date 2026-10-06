import React, { useMemo, useState } from "react";
import { ic } from "../nav";
import { Users, TriangleAlert } from "lucide-react";
import {
  MAIN_SUBJECTS, VULNERABLE_GROUPS, PRESENCE_FIELDS, PACKAGE_ANGLES, NO_GROUP,
  diversityBlockers, present, monthlySummary, monthsLogged, type Entry,
} from "../diversity";

/**
 * The diversity tracker — Policy P3 §4.1 step 2 on the piece, §4.3 for the month (handbook ed.7).
 * «متتبّع التنوّع»
 *
 * Two screens from one module: the form the author fills while producing (and the gate refuses
 * fact-check without), and the monthly reading the planning meeting does. Both call the same
 * diversityBlockers the server does, so the desk is never told it is done when the server disagrees.
 */
const post = (p: string, b: any) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
const label = (row: [string, string, string], ar: boolean) => ar ? row[2] : row[1];

/** The tracker form for one piece, shown in its drawer while it is in production. */
export function DiversityForm({ item, entry, currentUser, t, lang, triggerToast, refreshState }: {
  item: any; entry: any; currentUser: any; t: (s: string) => string; lang: string;
  triggerToast: (m: string, k?: string) => void; refreshState: () => void;
}) {
  const ar = lang === "ar";
  const [form, setForm] = useState<Entry & { groups: string[] }>(() => ({
    mainSubject: entry?.mainSubject || "",
    mentionedWomen: entry?.mentionedWomen || "", mentionedMen: entry?.mentionedMen || "",
    expertWomen: entry?.expertWomen || "", expertMen: entry?.expertMen || "",
    notes: entry?.notes || "",
    groups: (() => { try { return JSON.parse(entry?.groupsJson || "[]"); } catch { return []; } })(),
  }));
  const [busy, setBusy] = useState(false);
  const gaps = diversityBlockers({ ...form, groupsJson: JSON.stringify(form.groups) });

  const toggleGroup = (key: string) => setForm(f => {
    // "none" and a named group are mutually exclusive: the first says we looked and found none.
    if (key === NO_GROUP) return { ...f, groups: f.groups.includes(NO_GROUP) ? [] : [NO_GROUP] };
    const without = f.groups.filter(g => g !== NO_GROUP);
    return { ...f, groups: without.includes(key) ? without.filter(g => g !== key) : [...without, key] };
  });

  const save = async () => {
    setBusy(true);
    const r = await post("/api/diversity/save", {
      contentItemId: item.id,
      entry: { ...form, title: item.title, programmeText: item.stream || "", loggedOn: entry?.loggedOn || "" },
      user: currentUser,
    }).catch((e: any) => ({ error: e.message }));
    setBusy(false);
    if (r.ok) { triggerToast(r.remaining?.length ? t("Saved — still incomplete.") : t("Diversity tracker saved.")); refreshState(); }
    else triggerToast(r.error || t("Could not save the tracker"), "error");
  };

  const pill = (field: string, value: string) => (
    <span className="flex flex-wrap items-center gap-1">
      {["none", "yes"].map(v => (
        <button key={v} type="button" onClick={() => setForm(f => ({ ...f, [field]: v }))}
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${value === v ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
          {v === "none" ? t("none") : t("yes")}
        </button>
      ))}
      <input value={/^\d+$/.test(value) ? value : ""} onChange={e => setForm(f => ({ ...f, [field]: e.target.value.replace(/\D/g, "") }))}
        dir="ltr" placeholder={t("or a number")} className="finance-input w-24 py-0.5 text-[11px]" />
    </span>
  );

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-2 space-y-2">
      <h5 className="font-bold text-slate-700 uppercase text-[10px] flex flex-wrap items-center gap-2">
        {ic(Users, "h-3 w-3")}{ar ? "متتبّع التنوّع" : "Diversity tracker"}
        <span className="font-normal normal-case text-slate-400">{t("Policy P3 §4.1 — logged while the piece is produced")}</span>
        {gaps.length === 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{t("complete")}</span>}
      </h5>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-[11px]">
        <div>
          <span className="block text-slate-600 font-bold mb-1">{ar ? "موضوع المادة الرئيسي" : "Main subject"}</span>
          <select value={form.mainSubject || ""} onChange={e => setForm(f => ({ ...f, mainSubject: e.target.value }))} className="finance-input w-full py-1">
            <option value="">— {t("choose")} —</option>
            {MAIN_SUBJECTS.map(row => <option key={row[0]} value={row[0]}>{label(row, ar)}</option>)}
          </select>
        </div>
        {PRESENCE_FIELDS.map(row => (
          <div key={row[0]}>
            <span className="block text-slate-600 font-bold mb-1">{label(row, ar)}</span>
            {pill(row[0], String((form as any)[row[0]] || ""))}
          </div>
        ))}
      </div>

      <div>
        <span className="block text-slate-600 font-bold mb-1 text-[11px]">{ar ? "الفئات الأكثر هشاشة" : "Vulnerable groups"}</span>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => toggleGroup(NO_GROUP)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${form.groups.includes(NO_GROUP) ? "bg-slate-900 text-white" : "bg-white border border-slate-300 hover:bg-slate-100"}`}>
            {ar ? "لا شيء" : "None"}
          </button>
          {VULNERABLE_GROUPS.map(row => (
            <button key={row[0]} type="button" onClick={() => toggleGroup(row[0])} dir="auto"
              className={`rounded-full px-2 py-0.5 text-[10px] ${form.groups.includes(row[0]) ? "bg-slate-900 text-white font-bold" : "bg-white border border-slate-300 hover:bg-slate-100"}`}>
              {label(row, ar)}
            </button>
          ))}
        </div>
      </div>

      <input value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} dir="auto"
        placeholder={ar ? "ملاحظات" : "Notes"} className="finance-input w-full text-[11px]" />

      {gaps.length > 0 && (
        <ul className="text-[10px] text-amber-800 list-disc ms-4">{gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
      )}
      <button onClick={save} disabled={busy} className="rounded bg-slate-900 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40">
        {busy ? t("Saving…") : t("Save the tracker")}
      </button>
    </div>
  );
}

/** §4.3: the month the planning meeting reads, and the one gap it names for the month ahead. */
export default function DiversityPanel({ state, currentUser, t, lang, triggerToast, refreshState }: any) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const rows: any[] = state?.diversityEntries || [];
  const months = useMemo(() => monthsLogged(rows), [rows]);
  const [month, setMonth] = useState("");
  const chosen = month || months[0] || "";
  const sum = useMemo(() => monthlySummary(rows, chosen), [rows, chosen]);
  const meetings: any[] = (state?.editorialMeetings || []).filter((m: any) => String(m.date || "").slice(0, 7) === chosen);
  const meeting = meetings[0];
  const [gap, setGap] = useState("");
  const canName = ["Production Manager", "Program Director", "Super Admin", "Chief Editor"].includes(currentUser?.role);

  const saveGap = async () => {
    const r = await post("/api/diversity/gap", { meetingId: meeting.id, gap, user: currentUser });
    if (r.ok) { triggerToast(t("Gap recorded for the month ahead.")); setGap(""); refreshState(); }
    else triggerToast(r.error || t("Could not record it"), "error");
  };

  const stat = (n: number, share: number, en: string, arLabel: string) => (
    <div className="rounded border border-slate-200 bg-white p-2">
      <p className="text-lg font-bold text-slate-900" dir="ltr">{share}%</p>
      <p className="text-[10px] text-slate-500" dir="auto">{ar ? arLabel : en} · <span dir="ltr">{n}/{sum.logged}</span></p>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-2 text-sm font-bold text-slate-800 uppercase font-mono">
        <span>{open ? "▾" : "▸"}</span>{ic(Users, "h-4 w-4")}{ar ? "متتبّع التنوّع" : "Diversity tracker"}
        <span className="ms-auto text-[10px] font-normal normal-case text-slate-400">
          {rows.length ? `${rows.length} ${t("pieces logged")}` : t("Policy P3 §4.3 — reviewed once a month")}
        </span>
      </button>

      {open && (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <select value={chosen} onChange={e => setMonth(e.target.value)} className="finance-input py-1" dir="ltr">
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-slate-500">{sum.logged} {t("pieces logged")}</span>
          </div>

          {sum.noneLogged ? <p className="text-slate-500">{t("Nothing logged in that month.")}</p> : (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {stat(sum.womenSubject, sum.womenSubjectShare, "a woman at the centre", "امرأة في صلب المادة")}
                {stat(sum.womenMentioned, sum.womenMentionedShare, "mention or quote women", "تذكر نساء أو تقتبس عنهنّ")}
                {stat(sum.womenExperts, sum.womenExpertsShare, "quote a woman expert", "تقتبس عن خبيرة")}
                {stat(sum.menExperts, sum.menExpertsShare, "quote a man expert", "تقتبس عن خبير")}
              </div>
              <div>
                <span className="block text-slate-600 font-bold mb-1">{ar ? "الفئات الأكثر هشاشة" : "Vulnerable groups covered"} <span dir="ltr">({sum.groupsCovered}/8)</span></span>
                <div className="flex flex-wrap gap-1">
                  {sum.groups.map(g => (
                    <span key={g.key} dir="auto" className={`rounded-full px-2 py-0.5 text-[10px] ${g.pieces ? "bg-emerald-50 text-emerald-800 font-bold" : "bg-slate-100 text-slate-400"}`}>
                      {ar ? g.ar : g.en}{g.pieces ? <> · <span dir="ltr">{g.pieces}</span></> : ""}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* §4.3: the meeting names ONE gap for the month ahead. */}
          <div className="rounded border border-slate-200 bg-slate-50 p-2 space-y-1">
            <p className="font-bold text-slate-700 text-[11px]">{t("The gap to close next month")} <span className="font-normal text-slate-400">({t("Policy P3 §4.3")})</span></p>
            {meeting?.diversityGap && <p className="text-[11px] text-slate-800" dir="auto">{meeting.diversityGap}</p>}
            {!meeting ? <p className="text-[10px] text-slate-400">{t("Record a planning meeting in that month to name the gap against it.")}</p>
              : canName && (
                <span className="flex flex-wrap gap-2">
                  <input value={gap} onChange={e => setGap(e.target.value)} dir="auto"
                    placeholder={ar ? "مثال: لم تُقتبس أي خبيرة هذا الشهر" : "e.g. no women quoted as experts this month"} className="finance-input flex-1 min-w-[200px] text-[11px]" />
                  <button onClick={saveGap} disabled={!gap.trim()} className="rounded bg-slate-900 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40">{t("Record")}</button>
                </span>
              )}
          </div>

          <details>
            <summary className="cursor-pointer text-[11px] text-slate-500">{t("The logged pieces")} ({sum.logged})</summary>
            <div className="divide-y divide-slate-100 mt-1">
              {rows.filter(r => String(r.loggedOn || "").slice(0, 7) === chosen).map(r => (
                <p key={r.id} className="flex flex-wrap items-center gap-2 py-1 text-[11px]" dir="auto">
                  <span className="font-mono text-slate-400" dir="ltr">{r.loggedOn}</span>
                  <span className="font-bold text-slate-800">{r.title || r.contentItemId}</span>
                  {r.programmeText && <span className="text-slate-500">{r.programmeText}</span>}
                  {present(r.expertWomen) && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">{ar ? "خبيرة" : "woman expert"}</span>}
                  {r.imported && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{t("from the sheet")}</span>}
                  {!!diversityBlockers(r).length && <span className="inline-flex items-center gap-1 text-[10px] text-amber-800">{ic(TriangleAlert, "h-3 w-3")}{t("incomplete")}</span>}
                </p>
              ))}
            </div>
          </details>

          <p className="text-[10px] text-slate-400" dir="auto">
            {ar ? "يسجّل المتتبّع ما في المادة؛ ولا يحكم عليها. السياسة P3 §2.5: التنوّع يُتحقَّق منه، لا يُفترض."
                : "The tracker records what is in a piece; it never judges one. Policy P3 §2.5: inclusivity is checked, not assumed."}
          </p>
        </div>
      )}
    </div>
  );
}

export { PACKAGE_ANGLES };
