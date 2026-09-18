import { useEffect, useState } from "react";
import { FileText, Download, Eye, Link2, Copy, Mail, MessageCircle, XCircle, AlertTriangle, Package } from "lucide-react";
import { withTicket } from "../docTicket";
import { ic } from "../nav";
import { PAPER_GROUPS, type PaperGroup } from "../officialPapers";

type Share = { token: string; url: string; expiresAt: string; by: string; at: string } | null;
type PaperRow = { id: string; ref: string; title: string; date: string; proves: string; group: PaperGroup; held: boolean; filename: string; share: Share; noLink: string };
type PolicyRow = { id: string; ref: string; label: string; policies: string[]; lang: "en" | "ar"; held: boolean; share: Share; noLink: string; filedOn: string; changedOn: string; stale: boolean };
type ReadingRow = { id: string; ref: string; filename: string; note: string; held: boolean };
type Shelf = {
  papers: PaperRow[]; zip: { id: string; ref: string; date: string; held: boolean };
  packDate: string; linkDays: number; linksReady: boolean; onceEnforced: boolean; policyPdfs: PolicyRow[]; reading: ReadingRow[];
};

const day = (iso: string) => (iso || "").slice(0, 10);

/**
 * A filename, shown in the order the file is actually named.
 *
 * Several of these papers carry Arabic inside a Latin name —
 * `2023_Constitutive_Statute_النظام_التأسيسي_Arabic_11pg.pdf`. With the whole string in one run,
 * the underscores between the Arabic words join them into a single right-to-left run, so the two
 * words come out swapped: measured in the browser, التأسيسي rendered at x=262 and النظام at x=343,
 * the reverse of the filename. `dir="ltr"` does not help — it sets the base direction, which was
 * never the problem — and neither does one `<bdi>` around the whole thing.
 *
 * Isolating each underscore-separated part does: each part keeps its place in the sequence while
 * its own letters still shape right-to-left (النظام at 262, التأسيسي at 325). So someone comparing
 * the screen against the vault reads the same name in the same order.
 */
const FileName = ({ name, className }: { name: string; className?: string }) => (
  <span dir="ltr" className={className}>
    {name.split("_").map((part, i) => (
      <span key={i}>{i > 0 && "_"}<bdi>{part}</bdi></span>
    ))}
  </span>
);

/**
 * The organisation's own papers, and the filed PDFs of the policies.
 *
 * Two things this screen refuses to do. It never offers a button for a file we do not hold —
 * four of the papers are a record with no file behind them, and a download that 404s would be a
 * lie told twice. And it never claims a filed policy PDF is current: the pack is a snapshot, so
 * a card whose policy has changed since says so on its face.
 */
export default function PapersShelf({ t, currentUser, triggerToast, openDoc }: {
  t: (s: string) => string;
  currentUser: any;
  triggerToast: (msg: string, typ?: "success" | "error") => void;
  openDoc: (d: { id: string; filename?: string; mimeType?: string }) => void;
}) {
  const mayOpen = ["Super Admin", "Finance Officer"].includes(currentUser?.role);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [busy, setBusy] = useState("");

  const load = async () => {
    try {
      const r = await fetch("/api/papers/shelf");
      if (r.ok) setShelf(await r.json());
    } catch { /* the shelf simply does not appear; the policies above are unaffected */ }
  };
  useEffect(() => { if (mayOpen) load(); }, [mayOpen]);

  if (!mayOpen || !shelf) return null;

  const call = async (path: string, id: string, ok: string) => {
    setBusy(id);
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "It did not work.");
      triggerToast(ok, "success");
      await load();
    } catch (e: any) { triggerToast(e.message, "error"); } finally { setBusy(""); }
  };

  /** A live link, with the three ways to send it. The FMS sends nothing — Saad or Marwan does. */
  const shareBox = (share: NonNullable<Share>, what: string, id: string) => {
    // The URL sits alone on its own line: WhatsApp only makes a line clickable when nothing
    // else shares it (learned on the quotation links).
    const body = `${t("Here is")} ${what}:\n\n${share.url}\n\n${t("The link works until")} ${day(share.expiresAt)}.`;
    return (
      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
        <p className="text-[11px] font-bold text-emerald-800">
          {t("Link live until")} {day(share.expiresAt)} · {t("issued by")} {share.by} {day(share.at)}
        </p>
        <p dir="ltr" className="mt-1 break-all font-mono text-[10.5px] text-emerald-900">{share.url}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button onClick={() => { navigator.clipboard?.writeText(share.url); triggerToast(t("Link copied"), "success"); }}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-300">
            {ic(Copy, "h-3 w-3")} {t("Copy")}
          </button>
          <a href={`mailto:?subject=${encodeURIComponent(what)}&body=${encodeURIComponent(body)}`}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-300">
            {ic(Mail, "h-3 w-3")} {t("Email")}
          </a>
          <a href={`https://wa.me/?text=${encodeURIComponent(body)}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-300">
            {ic(MessageCircle, "h-3 w-3")} {t("WhatsApp")}
          </a>
          <button disabled={busy === id} onClick={() => call("/api/papers/share/revoke", id, t("Link revoked"))}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-50">
            {ic(XCircle, "h-3 w-3")} {t("Revoke")}
          </button>
        </div>
      </div>
    );
  };

  /** Preview / Download / Share — or, for a paper we do not hold, an honest grey strip. */
  const actions = (row: { id: string; held: boolean; share: Share; noLink: string }, filename: string, what: string) => {
    if (!row.held) {
      return (
        <div className="mt-3 rounded-lg bg-slate-100 p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            {ic(AlertTriangle, "h-3.5 w-3.5")} {t("Record only — the file is missing")}
          </p>
          {filename && <FileName name={filename} className="mt-0.5 block break-all font-mono text-[10px] text-slate-500" />}
        </div>
      );
    }
    return (
      <>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => openDoc({ id: row.id, filename, mimeType: "application/pdf" })}
            className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
            {ic(Eye, "h-3 w-3")} {t("Preview")}
          </button>
          <a href={withTicket(`/api/document/content/${row.id}`)} download={filename}
            className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-300">
            {ic(Download, "h-3 w-3")} {t("Download")}
          </a>
          {!row.share && shelf.linksReady && !row.noLink && (
            <button disabled={busy === row.id} onClick={() => call("/api/papers/share", row.id, t("Link created"))}
              className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-300 disabled:opacity-50">
              {ic(Link2, "h-3 w-3")} {t("Send a link")}
            </button>
          )}
        </div>
        {row.share && shareBox(row.share, what, row.id)}
        {/* Why there is no button, in a sentence. A card that simply lacks one reads as a bug. */}
        {!row.share && row.noLink && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t(row.noLink)}</p>}
      </>
    );
  };

  // Object.entries widens the value to unknown, so the pairs are built as a typed list instead.
  const labels: string[] = shelf.policyPdfs.map(p => p.label).filter((l, i, a) => a.indexOf(l) === i);
  const byLabel: [string, PolicyRow[]][] = labels.map(l => [l, shelf.policyPdfs.filter(p => p.label === l)]);

  return (
    <div className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">{ic(FileText, "h-5 w-5")} {t("Official papers")}</h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            {shelf.linksReady
              ? `${t("The organisation's own papers. Opened by the Executive Director and the Finance Officer; a link lasts")} ${shelf.linkDays} ${t("days.")}`
              : t("The organisation's own papers. Opened by the Executive Director and the Finance Officer. Sending one as a link is not switched on — these papers need an AnaHon address of their own, which is with Saad.")}
          </p>
        </div>
        {shelf.zip.held && (
          <a href={withTicket(`/api/document/content/${shelf.zip.id}`)} download
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300">
            {ic(Package, "h-4 w-4")} {t("Download all")} ({shelf.zip.date})
          </a>
        )}
      </div>

      {PAPER_GROUPS.map(g => {
        const rows = shelf.papers.filter(p => p.group === g);
        if (!rows.length) return null;
        return (
          <div key={g}>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t(g)}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {rows.map(p => (
                <div key={p.id} className={`rounded-xl border bg-white p-4 ${p.held ? "border-slate-200" : "border-slate-200 bg-slate-50"}`}>
                  <p dir="auto" className="text-sm font-bold leading-snug text-slate-900 [text-align:match-parent]">{p.title}</p>
                  <p className="mt-1 font-mono text-[10.5px] text-slate-400">{p.ref}{p.date && ` · ${p.date}`}</p>
                  {p.proves && <p dir="auto" className="mt-1.5 text-[12px] leading-relaxed text-slate-600 [text-align:match-parent]">{p.proves}</p>}
                  {actions(p, p.filename, `${p.title} (${p.ref})`)}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {shelf.reading.length > 0 && (
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t("The reading behind the papers")}</h3>
          <p className="mt-1 text-[11.5px] text-slate-500">
            {t("What was read out of the papers and written down: the statute article by article, the facts, the alignment work, the letters. Working documents — they are not sent as links.")}
          </p>
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {shelf.reading.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3">
                <span className="font-mono text-[10.5px] text-slate-400">{r.ref}</span>
                <span className="min-w-0 flex-1">
                  {/* The note is what the row says it is; the filename is only where it lives. */}
                  {r.note
                    ? <span dir="auto" className="block text-[12.5px] leading-snug text-slate-800 [text-align:match-parent]">{r.note}</span>
                    : <FileName name={r.filename} className="block text-[12.5px] leading-snug text-slate-800" />}
                  {r.note && <FileName name={r.filename} className="mt-0.5 block truncate font-mono text-[10px] text-slate-400" />}
                </span>
                {r.held ? (
                  <span className="flex gap-1.5">
                    <button onClick={() => openDoc({ id: r.id, filename: r.filename })}
                      className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">
                      {ic(Eye, "h-3 w-3")} {t("Preview")}
                    </button>
                    <a href={withTicket(`/api/document/content/${r.id}`)} download={r.filename}
                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-300">
                      {ic(Download, "h-3 w-3")} {t("Download")}
                    </a>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-500">{t("Record only — the file is missing")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t("The policies, as PDFs to send")}</h3>
        <p className="mt-1 text-[11.5px] text-slate-500">
          {t("Filed")} {shelf.packDate}. {t("These are a snapshot, by handbook — a policy travels with the others in its handbook.")}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {byLabel.map(([label, rows]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-900">{label}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {rows[0].policies.length ? rows[0].policies.join(", ") : t("The index")}
              </p>
              {rows.some(r => r.stale) && (
                <p className="mt-2 flex items-start gap-1.5 rounded bg-amber-50 p-2 text-[11px] font-bold text-amber-800">
                  {ic(AlertTriangle, "h-3.5 w-3.5 shrink-0")}
                  {t("This PDF is from")} {rows.find(r => r.stale)?.filedOn}; {t("the policy changed on")} {rows.find(r => r.stale)?.changedOn}. {t("Render the pack again before sending it.")}
                </p>
              )}
              {rows.map(r => (
                <div key={r.id} className="mt-3 border-t border-slate-100 pt-3 first:border-0">
                  <p className="font-mono text-[10.5px] text-slate-400">{r.lang === "en" ? t("English") : t("Arabic")} · {r.ref}</p>
                  {actions(r, `${label} (${r.lang.toUpperCase()}).pdf`, `${label}${rows[0].policies.length ? ` (${rows[0].policies.join(", ")})` : ""}`)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
