import { useEffect, useMemo, useRef, useState } from "react";
import { Users, AlertTriangle, Clock, Inbox, FileWarning, X } from "lucide-react";
import { SharedProps } from "./shared";
import { deskItems, localToday, DeskItem } from "../workflow";
import { doorsFor } from "../helpBot";
import { NAV } from "../nav";

/**
 * The Virtual Office — the whole team at their desks in a walkable pixel office, drawn
 * from the same engine My Desk reads. src/workflow.ts answers "whose turn is it?"; here
 * every active person is a character in their room, and clicking one opens their real desk.
 *
 * Nothing new is computed and nothing is written. officeDesks() runs deskItems() in the
 * browser for each active user against the state this viewer already holds — which is why
 * the door is *full only (nav.tsx): those roles receive the untrimmed state, so every desk
 * is the true one.
 *
 * The world is a lightweight adaptation of a16z's ai-town: characters walk with a
 * direction sprite (down/up/side, right = the side flipped) and a walk-bob — but no Pixi,
 * no server sim, no tilemap. To keep them off the walls and furniture they move only along
 * a hand-authored WALKABLE GRAPH (NODES/EDGES below, every edge verified to lie on open
 * floor), pathing node-to-node with BFS. Art is generated once (Higgsfield) and animated
 * from real desk data; never per-task video.
 *
 * Stage 1 of the Virtual Office. Messages and the meeting-room function are later stages;
 * an agent may never fill a policy-gated approval — see [[anahon-virtual-office-agents]].
 */
const DOORS = NAV.flatMap(s => s.items);
const MAP = "/assets/office/office-map.jpg";
const MAP_RATIO = 1792 / 1013;
const SPRITE_H = 0.13;                 // sprite height as a fraction of the map height
const WALK = 0.05;                     // fraction of the map per second
const STRIDE = 0.028;                  // distance between foot-swaps in the walk cycle
// One walk cycle, grid-engine's model: left-foot, standing, right-foot, standing. "" = the
// standing sprite (<dir>.png); "1"/"2" = the two stride sprites (<dir>1.png / <dir>2.png).
const CYCLE = ["1", "", "2", ""];

type Vec = [number, number];
type Cell = [number, number];

/* ── The walkability grid + A* ─────────────────────────────────────────────────
 * The floor is described as walkable rectangles minus furniture (verified against the map
 * with a grid overlay), rasterised once to a GW×GH boolean grid. Characters free-roam:
 * A* finds a path over walkable cells, so they cross only open floor — never the meeting
 * table, a desk, or a wall. No Pixi, no tilemap file — just this array.
 */
const GW = 50, GH = 28;
const WALK_RECTS: [number, number, number, number][] = [
  [0.35, 0.10, 0.64, 0.86], [0.06, 0.26, 0.30, 0.33], [0.29, 0.28, 0.37, 0.33],
  [0.06, 0.50, 0.34, 0.62], [0.30, 0.53, 0.38, 0.58], [0.71, 0.26, 0.92, 0.33], [0.62, 0.27, 0.72, 0.33],
  [0.68, 0.44, 0.96, 0.53], [0.62, 0.46, 0.70, 0.52], [0.61, 0.78, 0.96, 0.87], [0.61, 0.64, 0.67, 0.87], [0.60, 0.64, 0.66, 0.72],
];
const BLOCK_RECTS: [number, number, number, number][] = [
  [0.41, 0.11, 0.59, 0.48], [0.35, 0.66, 0.50, 0.81], [0.53, 0.66, 0.63, 0.84], [0.69, 0.52, 0.82, 0.62],
  [0.07, 0.50, 0.22, 0.60], [0.62, 0.68, 0.80, 0.83],
];
const inRects = (rs: [number, number, number, number][], x: number, y: number) =>
  rs.some(([a, b, c, d]) => a <= x && x <= c && b <= y && y <= d);
const GRID: boolean[][] = Array.from({ length: GH }, (_, gy) =>
  Array.from({ length: GW }, (_, gx) => {
    const x = (gx + 0.5) / GW, y = (gy + 0.5) / GH;
    return inRects(WALK_RECTS, x, y) && !inRects(BLOCK_RECTS, x, y);
  }));
const WALKCELLS: Cell[] = GRID.flatMap((row, gy) => row.map((w, gx) => (w ? [gx, gy] as Cell : null)).filter(Boolean) as Cell[]);
const walkable = (gx: number, gy: number) => gx >= 0 && gy >= 0 && gx < GW && gy < GH && GRID[gy][gx];
const cellOf = (fx: number, fy: number): Cell => [Math.min(GW - 1, Math.max(0, Math.floor(fx * GW))), Math.min(GH - 1, Math.max(0, Math.floor(fy * GH)))];
const centerOf = (c: Cell): Vec => [(c[0] + 0.5) / GW, (c[1] + 0.5) / GH];
const DIRS8: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** A* over the grid (8-connected, no corner-cutting). Returns cells [start,…,goal]. */
function astar(s: Cell, g: Cell): Cell[] {
  if (!walkable(...g)) return [s];
  const key = (c: Cell) => c[1] * GW + c[0];
  const open: [number, Cell][] = [[0, s]];
  const came = new Map<number, Cell>(); const gScore = new Map<number, number>([[key(s), 0]]);
  const h = (c: Cell) => Math.abs(c[0] - g[0]) + Math.abs(c[1] - g[1]);
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const cur = open.shift()![1];
    if (cur[0] === g[0] && cur[1] === g[1]) {
      const path: Cell[] = [cur]; let k = key(cur);
      while (came.has(k)) { const p = came.get(k)!; path.unshift(p); k = key(p); }
      return path;
    }
    for (const [dx, dy] of DIRS8) {
      const nx = cur[0] + dx, ny = cur[1] + dy;
      if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(cur[0] + dx, cur[1]) || !walkable(cur[0], cur[1] + dy))) continue;
      const nk = ny * GW + nx, tentative = (gScore.get(key(cur)) ?? Infinity) + (dx && dy ? 1.414 : 1);
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, cur); gScore.set(nk, tentative);
        open.push([tentative + h([nx, ny]), [nx, ny]]);
      }
    }
  }
  return [s];
}
/** A wander target: often near home, sometimes home itself, occasionally anywhere. */
function pickTarget(home: Vec): Cell {
  if (Math.random() < 0.25) return cellOf(home[0], home[1]);
  if (Math.random() < 0.6) {
    const near = WALKCELLS.filter(c => { const [x, y] = centerOf(c); return Math.abs(x - home[0]) < 0.18 && Math.abs(y - home[1]) < 0.16; });
    if (near.length) return near[Math.floor(Math.random() * near.length)];
  }
  return WALKCELLS[Math.floor(Math.random() * WALKCELLS.length)];
}

/** Role → sprite + a walkable home cell (their desk-front). */
const ROLE_ROOM: Record<string, { key: string; home: Vec }> = {
  "Super Admin": { key: "director", home: [0.25, 0.32] },
  "Program Director": { key: "director", home: [0.25, 0.32] },
  "Executive Director": { key: "director", home: [0.25, 0.32] },
  "Finance Officer": { key: "finance", home: [0.78, 0.31] },
  "HR / Payroll Officer": { key: "finance", home: [0.78, 0.31] },
  "Project Officer": { key: "projects", home: [0.27, 0.56] },
  "Project Lead": { key: "projects", home: [0.27, 0.56] },
  "Procurement and Logistics Officer": { key: "procurement", home: [0.85, 0.46] },
  "Digital Officer": { key: "digital", home: [0.74, 0.84] },
  "Chief Editor": { key: "digital", home: [0.74, 0.84] },
};
const FALLBACK = { key: "director", home: [0.50, 0.75] as Vec };

// Placed, seated characters that are not part of the desk engine — hand-positioned, no
// movement. Sally sits in the director's desk chair.
const EXTRAS: { id: string; name: string; sprite: string; pos: Vec; h: number }[] = [
  // Cropped to the waist and anchored at the desk's back edge, so the desk renders in front
  // of her and she reads as sitting behind it (a background image can't occlude a sprite).
  { id: "sally", name: "Sally", sprite: "sally/sit", pos: [0.205, 0.225], h: 0.15 },
];

type Person = {
  u: any; items: DeskItem[]; active: DeskItem[];
  overdue: number; week: number; backlog: number; load: number; busy: 0 | 1 | 2 | 3;
};

/**
 * Every active person's desk, ranked most-behind first. Pure — the same deskItems the
 * whole system reads, one pass per person over the state the caller holds. Exported so
 * scripts/check-office.ts can read every branch back without a browser.
 */
export function officeDesks(state: any, today: string): Person[] {
  return (state.users || [])
    .filter((u: any) => u.active)
    .map((u: any): Person => {
      const doors = new Set(doorsFor(u.role));
      const items = deskItems({ id: u.id, email: u.email, role: u.role }, state, today)
        .filter(i => (i.group === "mine" || i.group === "cover") && doors.has(i.door));
      const active = items.filter(i => !i.standing);
      const overdue = active.filter(i => i.urgency === "overdue").length;
      const week = active.filter(i => i.urgency === "week").length;
      const backlog = items.length - active.length;
      const busy = (overdue ? 3 : week ? 2 : active.length ? 1 : 0) as 0 | 1 | 2 | 3;
      return { u, items, active, overdue, week, backlog, load: active.length, busy };
    })
    .sort((a: Person, b: Person) => b.overdue - a.overdue || b.week - a.week || b.load - a.load || a.u.name.localeCompare(b.u.name));
}

type Char = { id: string; name: string; spriteKey: string; home: Vec; overdue: number };

type Sim = { x: number; y: number; queue: { x: number; y: number; wait?: number }[]; waitUntil: number; dir: string; last: string; moving: boolean; walk: number; frame: string };

function OfficeFloor({ chars, onSelect, selectedId }: { chars: Char[]; onSelect: (id: string) => void; selectedId: string | null }) {
  const wrapRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const imgRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const sim = useRef<Map<string, Sim>>(new Map());

  useEffect(() => {
    const next = new Map<string, Sim>();
    for (const c of chars) {
      const [hx, hy] = c.home;
      next.set(c.id, sim.current.get(c.id) || { x: hx, y: hy, queue: [], waitUntil: 0, dir: "down", last: "", moving: false, walk: 0, frame: "" });
    }
    sim.current = next;
  }, [chars]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;

      for (const c of chars) {
        const s = sim.current.get(c.id); if (!s) continue;
        const wrap = wrapRefs.current.get(c.id); if (!wrap) continue;
        s.moving = false;
        // Idle and dwell over → free-roam to a new A*-reachable cell.
        if (!reduce && now >= s.waitUntil && !s.queue.length) {
          const path = astar(cellOf(s.x, s.y), pickTarget(c.home));
          if (path.length > 1) s.queue = path.slice(1).map(p => { const [x, y] = centerOf(p); return { x, y }; });
          else s.waitUntil = now + 2000 + Math.random() * 3000;   // nowhere to go — wait, retry
        }
        if (now >= s.waitUntil && s.queue.length) {
          const t = s.queue[0];
          const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy);
          if (d < 0.006) {
            s.x = t.x; s.y = t.y; s.queue.shift();
            if (!s.queue.length) s.waitUntil = now + 1500 + Math.random() * 4000;   // arrived → dwell
          } else {
            const step = Math.min(d, WALK * dt);
            s.x += (dx / d) * step; s.y += (dy / d) * step; s.moving = true; s.walk += step;
            s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
          }
        }
        const bob = s.moving ? Math.abs(Math.sin(now / 110)) * 1 : 0;
        wrap.style.left = `${s.x * 100}%`;
        wrap.style.top = `${s.y * 100}%`;
        wrap.style.transform = `translate(-50%, calc(-100% + ${-bob}px))`;
        wrap.style.zIndex = String(Math.round(s.y * 1000));
        const img = imgRefs.current.get(c.id);
        if (img) {
          const view = s.dir === "up" ? "up" : s.dir === "down" ? "down" : "side";
          const suffix = s.moving ? CYCLE[Math.floor(s.walk / STRIDE) % CYCLE.length] : "";
          const frame = view + suffix;
          if (frame !== s.frame) { s.frame = frame; img.src = `/assets/office/sprites/${c.spriteKey}/${view}${suffix}.png`; }
          if (s.dir !== s.last) { s.last = s.dir; img.style.transform = s.dir === "right" ? "scaleX(-1)" : "none"; }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [chars]);

  return (
    <>
      {chars.map(c => {
        const [hx, hy] = c.home;
        return (
          <div
            key={c.id}
            ref={el => { if (el) wrapRefs.current.set(c.id, el); else wrapRefs.current.delete(c.id); }}
            className="absolute cursor-pointer select-none"
            style={{ left: `${hx * 100}%`, top: `${hy * 100}%`, height: `${SPRITE_H * 100}%`, transform: "translate(-50%,-100%)" }}
            onClick={() => onSelect(c.id)}
            role="button"
            title={c.name}
          >
            <div className="pointer-events-none absolute -top-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap">
              {c.overdue > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-[#E23B3B] px-1.5 py-px text-[9px] font-bold text-white shadow">
                  <AlertTriangle className="h-2.5 w-2.5" /> {c.overdue}
                </span>
              )}
              <span className={`rounded-full px-1.5 py-px text-[9px] font-bold shadow ${selectedId === c.id ? "bg-[#6D1A1A] text-white" : "bg-white/85 text-slate-700"}`}>
                {c.name.split(" ")[0]}
              </span>
            </div>
            <img
              ref={el => { if (el) imgRefs.current.set(c.id, el); else imgRefs.current.delete(c.id); }}
              src={`/assets/office/sprites/${c.spriteKey}/down.png`}
              alt={c.name}
              draggable={false}
              className="h-full w-auto drop-shadow-[0_3px_2px_rgba(0,0,0,0.35)]"
            />
          </div>
        );
      })}
    </>
  );
}

export default function OfficeTab({ state, t, handleNavClick }: SharedProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const today = localToday();
  const people = useMemo(() => officeDesks(state, today), [state, today]);

  const chars = useMemo<Char[]>(() =>
    people.map(p => {
      const r = ROLE_ROOM[p.u.role] || FALLBACK;
      return { id: p.u.id, name: p.u.name, spriteKey: r.key, home: r.home, overdue: p.overdue };
    }), [people]);

  const selected = people.find(p => p.u.id === selectedId) || null;
  const totalOverdue = people.reduce((n, p) => n + p.overdue, 0);
  const num = (n: number) => <span dir="ltr">{n}</span>;

  const row = (i: DeskItem) => {
    const door = DOORS.find(x => x.navKey === i.door);
    const chip = i.urgency === "overdue"
      ? { text: t("overdue"), cls: "text-red-700 bg-red-50 border-red-200" }
      : i.urgency === "week"
        ? { text: t("this week"), cls: "text-[#8f2020] bg-[#F88888]/20 border-[#F88888]" }
        : { text: i.when || t("no date"), cls: "text-slate-500 bg-slate-50 border-slate-200" };
    return (
      <button key={i.id} onClick={() => handleNavClick(i.door)} className="flex w-full items-start gap-3 border-b border-slate-100 px-1 py-2 text-start last:border-0 hover:bg-slate-50">
        <span className="mt-0.5 shrink-0 text-slate-400">{door?.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-snug text-slate-900">
            {i.verb && <b className="font-semibold">{t(i.verb)} · </b>}{i.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
            {door && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{t(door.label)}</span>}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{t(i.status)}</span>
            {i.seats.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">{t("seat")}: {i.seats.map(x => t(x)).join(", ")}</span>}
          </span>
        </span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>{chip.text}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4A1010] via-[#6D1A1A] to-[#4A1010] px-5 py-4 text-white shadow-md">
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 shrink-0 text-white/90" />
            <div>
              <h2 className="text-lg font-bold leading-tight">{t("Virtual Office")}</h2>
              <p className="text-[11px] text-white/70">{t("The whole team, at their desks — click a person to open their desk.")}</p>
            </div>
          </div>
          {totalOverdue > 0 && (
            <span className="rounded-full bg-[#E23B3B] px-3 py-1 text-[11px] font-bold shadow">{num(totalOverdue)} {t("overdue across the office")}</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full" style={{ aspectRatio: String(MAP_RATIO), backgroundImage: `url(${MAP})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          {people.length === 0
            ? <div className="absolute inset-0 grid place-items-center text-sm text-white/90">{t("Nobody is set up with a desk yet.")}</div>
            : <OfficeFloor chars={chars} onSelect={id => setSelectedId(id)} selectedId={selectedId} />}
          {EXTRAS.map(e => (
            <div key={e.id} className="pointer-events-none absolute select-none"
              style={{ left: `${e.pos[0] * 100}%`, top: `${e.pos[1] * 100}%`, height: `${e.h * 100}%`, transform: "translate(-50%,-100%)", zIndex: Math.round(e.pos[1] * 1000) }}>
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-1.5 py-px text-[9px] font-bold text-slate-700 shadow">{e.name}</span>
              <img src={`/assets/office/sprites/${e.sprite}.png`} alt={e.name} draggable={false} className="h-full w-auto drop-shadow-[0_3px_2px_rgba(0,0,0,0.35)]" />
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border border-[#6D1A1A]/30 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{selected.u.name}</h3>
              <p className="text-[11px] text-slate-500">{t(selected.u.role)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {selected.overdue > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"><AlertTriangle className="h-3 w-3" /> {num(selected.overdue)} {t("overdue")}</span>}
              {selected.week > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-[#F88888] bg-[#F88888]/20 px-2 py-0.5 text-[10px] font-bold text-[#8f2020]"><Clock className="h-3 w-3" /> {num(selected.week)} {t("this week")}</span>}
              {selected.load - selected.overdue - selected.week > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600"><Inbox className="h-3 w-3" /> {num(selected.load - selected.overdue - selected.week)} {t("waiting")}</span>}
              {selected.backlog > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500"><FileWarning className="h-3 w-3" /> {num(selected.backlog)} {t("to file")}</span>}
              <button onClick={() => setSelectedId(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title={t("Close")}><X className="h-4 w-4" /></button>
            </div>
          </div>
          {selected.items.length === 0
            ? <p className="py-2 text-[12px] text-slate-500">{t("Nothing is waiting on them.")}</p>
            : selected.items.map(row)}
        </div>
      )}

      {!selected && people.length > 0 && (
        <p className="text-center text-[11px] text-slate-400">{t("Click a character to see what is on their desk.")}</p>
      )}
    </div>
  );
}
