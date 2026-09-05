import { SharedProps } from "./shared";

export default function HandbooksTab({ openDoc, state }: SharedProps) {
            const books = state.documents
              .filter(d => d.category === "Handbook")
              // The filename carries a policy number as a suffix — order by it, not alphabetically.
              .map(d => ({ d, no: (d.filename.match(/_(\d{3})\.docx$/) || [])[1] || "" }))
              .sort((a, b) => a.no.localeCompare(b.no) || a.d.filename.localeCompare(b.d.filename));
            const pretty = (f: string) => f
              .replace(/\.docx$/i, "").replace(/_\d{3}$/, "")
              .replace(/^Ana[Hh]on[_\s-]*/i, "").replace(/[_]+/g, " ").trim();
            const nums = books.map(b => b.no).filter(Boolean);
            const gaps = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(3, "0"))
              .filter(n => !nums.includes(n) && n <= (nums[nums.length - 1] || "000"));
            const dupes = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))];

            return (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Policies & Handbooks</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    AnaHon's institutional policies. Funders ask for these by name — the ARIJ form has a
                    policies checklist. Click any one to read it here.
                  </p>
                </div>

                {(gaps.length > 0 || dupes.length > 0) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                    <strong>Numbering:</strong>{" "}
                    {gaps.length > 0 && <>missing {gaps.join(", ")}. </>}
                    {dupes.length > 0 && <>number {dupes.join(", ")} used twice. </>}
                    Either the missing ones were never written, or they exist and are not here.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {books.map(({ d, no }) => (
                    <button key={d.id} onClick={() => openDoc(d)}
                      className="text-start p-4 bg-white border border-slate-200 rounded-xl hover:border-red-300 hover:shadow-md transition flex items-start gap-3">
                      <span className="text-lg leading-none pt-0.5">📘</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{pretty(d.filename)}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {no && `#${no} · `}{d.refNo} · {d.sizeStr}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {!books.length && (
                  <p className="text-sm text-slate-500">No handbooks registered yet.</p>
                )}
              </div>
            );
}
