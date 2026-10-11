import type { LostRow, lostFiles } from "./lostFiles";

/**
 * "Files lost from the vault" — the section at the foot of the Missing documents drawer.
 * Read-only on purpose: a file is re-attached by putting the scan back at the record's path, and the line
 * leaves the list by itself on the next load. What opening a line does belongs to the drawer (onOpen).
 */
export default function LostFilesSection({ lost, project, t, onOpen }: {
  lost: ReturnType<typeof lostFiles>;
  project: (id: string) => { code: string; name: string } | undefined;
  t: (s: string) => string;
  onOpen: (r: LostRow) => void;
}) {
  if (lost.total === 0) return null;
  return (
    <div data-lost-files className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
        <p className="text-xs font-bold text-amber-900">{t("Files lost from the vault")} ({lost.total})</p>
        <p className="text-[10px] text-amber-800 mt-0.5">
          {lost.vouchers > 0 && <>{lost.vouchers} {t("of them are scans of posted vouchers")}. </>}
          {t("The record is here, the scan is not. Putting the file back at the record's path takes it off this list by itself.")}
        </p>
      </div>
      {lost.groups.map(g => {
        const p = project(g.projectId);
        return (
          <div key={g.projectId || "none"}>
            <p className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-700 flex items-baseline gap-2">
              <span className="flex-1 min-w-0">
                {p ? <><bdi dir="ltr" className="font-mono">{p.code}</bdi> · <bdi>{p.name}</bdi></> : t("Not tied to a project")}
              </span>
              <span dir="ltr" className="shrink-0 font-mono text-slate-500">{g.rows.length}</span>
            </p>
            <div className="divide-y divide-slate-100">
              {g.rows.map(r => (
                <button key={r.id} onClick={() => onOpen(r)} className="w-full text-start px-3 py-2 hover:bg-slate-50">
                  {/* The file name is what tells you what to scan again, so it is never cut off: it gets its own line. */}
                  <span className="flex items-baseline gap-2 text-[10px]">
                    <span dir="ltr" className="font-mono font-bold text-slate-500 shrink-0">{r.refNo}</span>
                    <span className="text-slate-400 truncate">
                      {r.voucherNo ? <bdi dir="ltr" className="font-mono">{r.voucherNo}</bdi> : <bdi>{r.category}</bdi>}
                    </span>
                  </span>
                  <span className="block text-[11px] text-slate-800 break-all"><bdi>{r.filename}</bdi></span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
