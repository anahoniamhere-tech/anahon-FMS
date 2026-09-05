import React, { useEffect, useState } from "react";
import Info from "./Info";

/**
 * Standing in for a vacant seat.
 *
 * AnaHon has posts nobody fills yet — the Chief Editor above all — and the work still
 * has to move. Rather than a second account that hides who is really pressing the
 * button, a Super Admin picks the seat here, and the server writes that seat into
 * every audit line the action produces. One person wearing two hats, on the record.
 */
type Seat = { role: string; holders: string[]; vacant: boolean };
/** What a seat is called in the organisation, where the system's key is a policy name. */
const SEAT_LABEL: Record<string, string> = {
  "Production Manager": "Production Team Leader (Production Manager)",
  "Program Director": "Programme Director seat (held by the Executive Director)",
  "HR / Payroll Officer": "HR and Payroll",
};
const seatName = (role: string) => SEAT_LABEL[role] || role;
type ActingLog = { id: string; userName: string; action: string; details: string; timestamp: string; actingAs: string | null };

export default function RoleSwitch({ currentUser, onChange }: { currentUser: any; onChange: (role: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [acting, setActing] = useState<string | null>(() => (window as any).__actingAs || null);
  const [log, setLog] = useState<ActingLog[]>([]);
  const [showLog, setShowLog] = useState(false);

  const isSuperAdmin = currentUser?.role === "Super Admin";
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/roles/seats").then(r => r.json()).then(setSeats).catch(() => {});
  }, [isSuperAdmin]);

  const loadLog = () => fetch("/api/audit/acting").then(r => r.json()).then(setLog).catch(() => {});
  const pick = (role: string | null) => {
    (window as any).__actingAs = role || undefined;
    setActing(role);
    setOpen(false);
    onChange(role);
  };

  if (!isSuperAdmin) return null;
  const vacant = seats.filter(s => s.vacant);
  const filled = seats.filter(s => !s.vacant && s.role !== currentUser?.role);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Act in another role"
        className={`rounded-full border px-3 py-1 text-xs font-bold ${acting
          ? "border-amber-400 bg-amber-400 text-slate-900"
          : "border-slate-600 text-slate-200 hover:bg-slate-800"}`}
      >
        {acting ? `🎭 acting as ${seatName(acting)}` : "🎭 Act as…"}
      </button>
      <Info id="acting-as" />

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 rounded-lg border border-slate-200 bg-white p-3 text-slate-800 shadow-xl">
          <p className="mb-2 text-xs text-slate-500">
            Pick a seat to stand in. Every action you take is recorded against your own name
            <em> and</em> the seat, so the record never suggests two people were involved.
          </p>

          {acting && (
            <button onClick={() => pick(null)} className="mb-2 w-full rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">
              Stop acting — go back to {currentUser?.role}
            </button>
          )}

          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Vacant seats</div>
          {vacant.length === 0 && <div className="px-1 pb-2 text-xs text-slate-400">Every role has someone in it.</div>}
          {vacant.map(s => (
            <button key={s.role} onClick={() => pick(s.role)}
              className={`mb-1 flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs hover:border-red-400 ${acting === s.role ? "border-red-500 bg-red-50" : "border-slate-200"}`}>
              <span className="font-semibold">{seatName(s.role)}</span>
              <span className="text-[10px] text-emerald-700">nobody in this seat</span>
            </button>
          ))}

          {filled.length > 0 && (
            <>
              <div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Seats someone else holds</div>
              {filled.map(s => (
                <button key={s.role} onClick={() => pick(s.role)}
                  className={`mb-1 flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs hover:border-amber-400 ${acting === s.role ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}>
                  <span className="font-semibold">{seatName(s.role)}</span>
                  <span className="text-[10px] text-amber-700">bypasses {s.holders.join(", ")}</span>
                </button>
              ))}
            </>
          )}

          <button onClick={() => { setShowLog(v => !v); if (!log.length) loadLog(); }}
            className="mt-3 w-full rounded border border-slate-300 px-2 py-1 text-xs">
            {showLog ? "Hide the record" : "See what was done in other seats"}
          </button>
          {showLog && (
            <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
              {log.length === 0 && <div className="text-xs text-slate-400">Nothing yet.</div>}
              {log.map(l => (
                <div key={l.id} className="rounded border border-slate-200 px-2 py-1 text-[11px]">
                  <div className="font-semibold">{l.userName} as {l.actingAs} — {l.action}</div>
                  <div className="text-slate-500">{new Date(l.timestamp).toLocaleString("en-GB")}</div>
                  <div className="text-slate-600">{l.details}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The banner that makes it impossible to forget which hat you have on. */
export function ActingBanner({ acting, onStop }: { acting: string | null; onStop: () => void }) {
  if (!acting) return null;
  return (
    <div className="flex items-center justify-center gap-3 bg-amber-400 px-4 py-1.5 text-xs font-bold text-slate-900">
      🎭 You are acting as {SEAT_LABEL[acting] || acting}. Everything you do is being recorded under your own name and this seat.
      <button onClick={onStop} className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Stop</button>
    </div>
  );
}
