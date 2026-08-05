import { useMemo, useState } from "react";
import { Newspaper, ShieldAlert, CheckCircle2 } from "lucide-react";
import { ContentItem } from "../types";
import { STREAMS, CONTENT_STATUSES, CONTENT_TYPES, CONTENT_CHANNELS, CONTENT_CHECKS, publishBlockers } from "../constants";
import { SharedProps } from "./shared";

// Editorial pipeline (Policies 002 & 005). The tab renders the register and the
// buttons; every rule lives server-side — the same publishBlockers() the server
// enforces produces the disabled-publish explanation here, so they cannot drift.

const STATUS_STYLE: Record<string, string> = {
  "Assigned": "bg-slate-100 text-slate-700",
  "In Production": "bg-blue-100 text-blue-700",
  "Fact-Check": "bg-amber-100 text-amber-700",
  "Editorial Review": "bg-purple-100 text-purple-700",
  "Approved": "bg-emerald-100 text-emerald-700",
  "Published": "bg-emerald-600 text-white"
};

const EDITOR_ROLES = ["Production Manager", "Program Director", "Super Admin"];

export default function EditorialTab({ state, currentUser, t, refreshState, triggerToast }: SharedProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<any | null>(null);
  const [mtgForm, setMtgForm] = useState<any | null>(null);
  const [srcForm, setSrcForm] = useState({ source: "", step: "" });
  const [legalForm, setLegalForm] = useState({ by: "", note: "" });
  const [corrForm, setCorrForm] = useState({ nature: "", correction: "" });
  const [checkerPick, setCheckerPick] = useState("");
  // Idea-desk chat: local thread; the AI prefills a draft, only a human saves it.
  // materials = links + vault uploads gathered in the panel; pendingFile = the latest
  // image/PDF, shown to the model once on the next send.
  const [chat, setChat] = useState<null | {
    messages: { role: string; text: string }[]; busy: boolean; draft: any | null;
    materials: { label: string; url: string; kind: string; description?: string }[];
    provider: string;
    pendingFile: { base64: string; mimeType: string; filename: string } | null;
  }>(null);
  const [chatInput, setChatInput] = useState("");
  const [matForm, setMatForm] = useState({ label: "", url: "", kind: "link" });
  const [linkForm, setLinkForm] = useState({ url: "", description: "", kind: "link" });
  const [upDesc, setUpDesc] = useState("");

  const isEditor = EDITOR_ROLES.includes(currentUser.role);
  const canManage = isEditor || currentUser.role === "Project Officer"; // server scope-checks POs

  const nameOf = (id: string) => state.users.find(u => u.id === id)?.name || "—";
  const activeUsers = state.users.filter(u => u.active);

  const post = async (path: string, body: any, ok?: string) => {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (ok) triggerToast(ok);
      refreshState();
      return true;
    } catch (err: any) {
      triggerToast(err.message, "error");
      return false;
    }
  };

  // Edits go through /save with the item's current fields merged over the patch.
  const saveItem = (item: ContentItem, patch: any, ok?: string) =>
    post("/api/content/save", {
      id: item.id, title: item.title, contentType: item.contentType, stream: item.stream,
      channels: item.channels, brief: item.brief, assigneeUserId: item.assigneeUserId,
      dueDate: item.dueDate, reviewedMeetingDate: item.reviewedMeetingDate,
      checks: item.checks, legalFlag: item.legalFlag, materials: item.materials, ...patch
    }, ok);

  const sendChat = async () => {
    if (!chat || !chatInput.trim() || chat.busy) return;
    const messages = [...chat.messages, { role: "user", text: chatInput.trim() }];
    setChat({ ...chat, messages, busy: true });
    setChatInput("");
    try {
      const res = await fetch("/api/content/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, materials: chat.materials, attachment: chat.pendingFile, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setChat(c => c ? {
        ...c,
        messages: [...messages, { role: "assistant", text: data.reply }],
        busy: false,
        draft: data.ready && data.draft ? data.draft : null,
        provider: data.provider || c.provider,
        pendingFile: null // the model has seen it; don't resend
      } : c);
    } catch (err: any) {
      triggerToast(err.message, "error");
      setChat(c => c ? { ...c, busy: false } : c);
    }
  };

  // Upload a reference file into the vault (GENERAL/Reference Material), then attach
  // it to the chat's materials with its description. Images/PDFs are also shown to
  // the model on the next send.
  const uploadChatFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result).split(",")[1] || "";
      try {
        const res = await fetch("/api/document/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name, mimeType: file.type,
            sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`,
            base64, category: "Reference Material",
            linkedRecordType: "Content Reference", linkedRecordId: "-",
            user: currentUser
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        const kind = file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : "doc";
        setChat(c => c ? {
          ...c,
          materials: [...c.materials, { label: upDesc || file.name, url: `/api/document/content/${data.doc.id}`, kind, description: upDesc }],
          pendingFile: (file.type.startsWith("image/") || file.type === "application/pdf")
            ? { base64, mimeType: file.type, filename: file.name } : c.pendingFile
        } : c);
        setUpDesc("");
        triggerToast(`${file.name} → vault (${data.doc.refNo || data.doc.id})`);
      } catch (err: any) {
        triggerToast(err.message, "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const MAT_ICON: Record<string, string> = { link: "🔗", photo: "🖼", video: "🎬", doc: "📄" };

  // Policy 002 weekly editorial meeting: reviews last week's content, plans the
  // coming week. Derived from the register — never stored.
  const today = new Date().toISOString().split("T")[0];
  const { pastWeek, comingWeek } = useMemo(() => {
    const day = 86400000;
    const ago7 = new Date(Date.now() - 7 * day).toISOString().split("T")[0];
    const ahead7 = new Date(Date.now() + 7 * day).toISOString().split("T")[0];
    const items = state.contentItems || [];
    return {
      pastWeek: items.filter(c => c.publishedAt && c.publishedAt.slice(0, 10) >= ago7),
      comingWeek: items.filter(c => c.status !== "Published" && c.dueDate && c.dueDate <= ahead7)
    };
  }, [state.contentItems]);

  const visible = (state.contentItems || []).filter(c => !statusFilter || c.status === statusFilter);

  // The meeting record for the current week (Policy 002: PD chairs, PM + POs attend),
  // plus recent history. Rows come sorted date-desc from the server.
  const weeklies = (state.editorialMeetings || []).filter(m => m.kind === "Weekly Editorial");
  const ago7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const thisWeekMtg = weeklies.find(m => m.date >= ago7);
  const pastMtgs = weeklies.filter(m => m !== thisWeekMtg).slice(0, 3);
  // Policy participants, preticked when opening a fresh attendance sheet.
  const policyAttendees = activeUsers
    .filter(u => ["Program Director", "Production Manager", "Project Officer", "Super Admin"].includes(u.role))
    .map(u => u.id);
  const canRecordMeeting = isEditor || currentUser.role === "Project Officer";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Newspaper className="h-5 w-5" /> {t("Editorial Desk")}</h2>
        <p className="text-xs text-slate-500">
          Policies 002 & 005, enforced: named independent fact-checker, dual approval (Production Manager + Programs Director),
          legal review when flagged, public dated corrections. The server refuses what the policy refuses.
        </p>
      </div>

      {/* Weekly editorial meeting — derived agenda + held-meeting record (Policy 002) */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 uppercase font-mono mb-3">📅 {t("Weekly Editorial Meeting")}</h3>

        {/* The held meeting: attendance sheet, direction, decisions */}
        {!mtgForm && thisWeekMtg && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800">{thisWeekMtg.date}</span>
              <span className="text-slate-500">{t("Attendance")}:</span>
              {thisWeekMtg.attendees.map(id => (
                <span key={id} className="bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-[10px]">{nameOf(id)}</span>
              ))}
              {canRecordMeeting && (
                <button onClick={() => setMtgForm({ id: thisWeekMtg.id, date: thisWeekMtg.date, attendees: [...thisWeekMtg.attendees], direction: thisWeekMtg.direction, notes: thisWeekMtg.notes })}
                  className="ml-auto text-[10px] bg-slate-200 hover:bg-slate-300 rounded px-2 py-1">{t("Edit Meeting")}</button>
              )}
            </div>
            {thisWeekMtg.direction && <p><span className="font-bold text-slate-600">{t("Direction for the week")}:</span> {thisWeekMtg.direction}</p>}
            {thisWeekMtg.notes && <p><span className="font-bold text-slate-600">{t("Decisions & notes")}:</span> {thisWeekMtg.notes}</p>}
            <p className="text-[10px] text-slate-400">{t("Recorded by")} {nameOf(thisWeekMtg.recordedBy)}</p>
          </div>
        )}
        {!mtgForm && !thisWeekMtg && canRecordMeeting && (
          <button onClick={() => setMtgForm({ date: today, attendees: policyAttendees, direction: "", notes: "" })}
            className="mb-4 bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2 shadow">
            📝 {t("Record This Week's Meeting")}
          </button>
        )}
        {mtgForm && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-600">{t("Meeting date")}</span>
              <input type="date" value={mtgForm.date} onChange={e => setMtgForm({ ...mtgForm, date: e.target.value })} className="finance-input py-1" disabled={!!mtgForm.id} />
            </div>
            <div>
              <span className="block font-bold text-slate-600 mb-1">{t("Attendance")} <span className="font-normal text-slate-400">(Policy 002: Programs Director, Production Manager, Project Officers)</span></span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {activeUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-1">
                    <input type="checkbox" checked={mtgForm.attendees.includes(u.id)}
                      onChange={e => setMtgForm({ ...mtgForm, attendees: e.target.checked ? [...mtgForm.attendees, u.id] : mtgForm.attendees.filter((x: string) => x !== u.id) })} />
                    {u.name} <span className="text-slate-400">({u.role})</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="block font-bold text-slate-600 mb-1">{t("Direction for the week")}</span>
              <textarea value={mtgForm.direction} onChange={e => setMtgForm({ ...mtgForm, direction: e.target.value })} rows={2} className="finance-input w-full" placeholder="Planning for upcoming content and coverage…" />
            </div>
            <div>
              <span className="block font-bold text-slate-600 mb-1">{t("Decisions & notes")}</span>
              <textarea value={mtgForm.notes} onChange={e => setMtgForm({ ...mtgForm, notes: e.target.value })} rows={2} className="finance-input w-full" placeholder="Issues addressed, performance review, decisions…" />
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { if (await post("/api/meetings/save", { kind: "Weekly Editorial", ...mtgForm }, "Meeting recorded")) setMtgForm(null); }}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded px-4 py-1.5 shadow">{t("Save")}</button>
              <button onClick={() => setMtgForm(null)} className="bg-slate-200 hover:bg-slate-300 rounded px-4 py-1.5">{t("Cancel")}</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <h4 className="font-bold text-slate-600 mb-2">{t("Past week")} — {t("Published")} ({pastWeek.length})</h4>
            {pastWeek.length === 0 && <p className="text-slate-400">Nothing published in the last 7 days.</p>}
            {pastWeek.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100">
                <span>{c.title} <span className="text-slate-400">({c.contentType})</span></span>
                {c.reviewedMeetingDate
                  ? <span className="text-emerald-600 text-[10px] font-mono shrink-0">reviewed {c.reviewedMeetingDate}</span>
                  : isEditor && (
                    <button onClick={() => saveItem(c, { reviewedMeetingDate: today }, `"${c.title}" marked reviewed`)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 shrink-0">
                      {t("Mark Reviewed in Weekly Meeting")}
                    </button>
                  )}
              </div>
            ))}
          </div>
          <div>
            <h4 className="font-bold text-slate-600 mb-2">{t("Coming week")} — {t("Due")} ({comingWeek.length})</h4>
            {comingWeek.length === 0 && <p className="text-slate-400">Nothing due in the next 7 days.</p>}
            {comingWeek.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100">
                <span>{c.title} <span className="text-slate-400">→ {nameOf(c.assigneeUserId)}</span></span>
                <span className={`text-[10px] font-mono shrink-0 ${c.dueDate < today ? "text-red-600 font-bold" : "text-slate-500"}`}>{c.dueDate}</span>
              </div>
            ))}
          </div>
        </div>

        {pastMtgs.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="font-bold uppercase text-[10px]">{t("Previous meetings")}:</span>{" "}
            {pastMtgs.map(m => (
              <span key={m.id} className="mr-3 font-mono">{m.date}{m.direction ? ` — ${m.direction.slice(0, 60)}${m.direction.length > 60 ? "…" : ""}` : ""}</span>
            ))}
          </div>
        )}
      </div>

      {/* Idea desk — brainstorm chat; AI prefills, only a human saves (house rule) */}
      {canManage && chat && (
        <div className="p-5 bg-slate-900 text-white border border-slate-800 rounded-xl shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase font-mono">💡 {t("Idea Desk")}</h3>
            <span className="flex items-center gap-3">
              {chat.provider && <span className="text-[10px] text-slate-400 font-mono">{t("Provided by")} {chat.provider}</span>}
              <button onClick={() => setChat(null)} className="text-slate-400 hover:text-white text-xs">✕ {t("Cancel")}</button>
            </span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
            {chat.messages.length === 0 && (
              <p className="text-slate-400 italic">Describe the idea — angle, who it serves, and paste any reference links, photos or videos. The desk will sharpen it and draft the assignment.</p>
            )}
            {chat.messages.map((m, i) => (
              <div key={i} className={`p-2.5 rounded-lg whitespace-pre-wrap ${m.role === "user" ? "bg-red-600/20 border border-red-600/30 ml-8" : "bg-slate-800 border border-slate-700 mr-8"}`}>
                {m.text}
              </div>
            ))}
            {chat.busy && <p className="text-slate-400 animate-pulse">Thinking…</p>}
          </div>
          {chat.draft && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700 rounded-lg text-xs space-y-1">
              <p className="font-bold text-emerald-300">{chat.draft.title} <span className="font-normal text-emerald-400">({chat.draft.contentType} · {chat.draft.stream || "no programme"})</span></p>
              <p className="text-slate-300 whitespace-pre-wrap">{chat.draft.brief.slice(0, 400)}{chat.draft.brief.length > 400 ? "…" : ""}</p>
              <p className="text-[10px] text-slate-400">
                {chat.draft.channels.join(", ") || "no channels"} · {chat.draft.materials.length} material(s){chat.draft.legalFlag ? " · ⚖ legal review flagged" : ""}
              </p>
              {(chat.draft.suggestedSources || []).length > 0 && (
                <div className="pt-1 border-t border-emerald-800/50">
                  <p className="font-bold text-emerald-300 text-[10px] uppercase">{t("Suggested sources (verify per Policy 005)")}</p>
                  {chat.draft.suggestedSources.map((s: any, i: number) => (
                    <p key={i} className="text-slate-300 text-[11px]">• <span className="font-bold">{s.name}</span> — {s.why}</p>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  const sources = (chat.draft.suggestedSources || []) as { name: string; why: string }[];
                  const brief = chat.draft.brief + (sources.length
                    ? `\n\nSUGGESTED SOURCES — verify per Policy 005:\n${sources.map(s => `- ${s.name} — ${s.why}`).join("\n")}`
                    : "");
                  setForm({ title: chat.draft.title, contentType: chat.draft.contentType, stream: chat.draft.stream, channels: chat.draft.channels, assigneeUserId: "", dueDate: "", brief, legalFlag: chat.draft.legalFlag, materials: chat.draft.materials });
                  setChat(null);
                }}
                className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded px-3 py-1.5">
                ✓ {t("Use This Draft")}
              </button>
            </div>
          )}
          {/* Attached materials so far */}
          {chat.materials.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {chat.materials.map((m, i) => (
                <span key={i} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                  {MAT_ICON[m.kind] || "🔗"} <span className="max-w-[160px] truncate">{m.label}</span>
                  <button onClick={() => setChat(c => c ? { ...c, materials: c.materials.filter((_, x) => x !== i) } : c)}
                    className="text-slate-500 hover:text-red-400">✕</button>
                </span>
              ))}
            </div>
          )}

          {/* Section 1 — the idea */}
          <div>
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">1 · {t("Brief")}</span>
            <div className="flex gap-2">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                rows={2}
                placeholder={t("Describe the idea, paste reference links…")}
                className="flex-1 bg-slate-950 text-xs px-3 py-2 rounded text-white border border-slate-800 outline-none resize-none"
              />
              <button onClick={sendChat} disabled={chat.busy || !chatInput.trim()}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold rounded px-4 shadow shrink-0">
                {t("Send")}
              </button>
            </div>
          </div>

          {/* Section 2 — reference links with description */}
          <div>
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">2 · {t("Links")}</span>
            <div className="flex flex-wrap gap-2">
              <input placeholder="https://…" value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })}
                className="flex-1 min-w-[160px] bg-slate-950 text-xs px-3 py-1.5 rounded text-white border border-slate-800 outline-none" />
              <input placeholder={t("Description")} value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })}
                className="flex-1 min-w-[140px] bg-slate-950 text-xs px-3 py-1.5 rounded text-white border border-slate-800 outline-none" />
              <select value={linkForm.kind} onChange={e => setLinkForm({ ...linkForm, kind: e.target.value })} aria-label="Link kind"
                className="bg-slate-950 text-xs px-2 py-1.5 rounded text-white border border-slate-800 outline-none">
                <option value="link">🔗 Link</option>
                <option value="photo">🖼 Photo</option>
                <option value="video">🎬 Video</option>
                <option value="doc">📄 Document</option>
              </select>
              <button
                onClick={() => {
                  if (!linkForm.url.trim()) return;
                  setChat(c => c ? { ...c, materials: [...c.materials, { label: linkForm.description || linkForm.url, url: linkForm.url.trim(), kind: linkForm.kind, description: linkForm.description }] } : c);
                  setLinkForm({ url: "", description: "", kind: "link" });
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs rounded px-3 py-1.5">+ {t("Add Material")}</button>
            </div>
          </div>

          {/* Section 3 — upload files (into the vault) with description */}
          <div>
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">3 · {t("Upload material")}</span>
            <div className="flex flex-wrap items-center gap-2">
              <input placeholder={t("Description")} value={upDesc} onChange={e => setUpDesc(e.target.value)}
                className="flex-1 min-w-[140px] bg-slate-950 text-xs px-3 py-1.5 rounded text-white border border-slate-800 outline-none" />
              <input type="file" aria-label={t("Upload material")}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadChatFile(f); e.target.value = ""; }}
                className="text-[10px] text-slate-400 file:bg-slate-800 file:text-white file:border-0 file:rounded file:px-3 file:py-1.5 file:text-xs file:mr-2 file:cursor-pointer" />
              <span className="text-[9px] text-slate-500">→ vault · Reference Material{chat.pendingFile ? ` · 👁 ${chat.pendingFile.filename} will be shown to the model` : ""}</span>
            </div>
          </div>
        </div>
      )}

      {/* New assignment — Policy 002: assignments come out of the daily production meeting */}
      {canManage && (
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          {!form ? (
            <span className="flex flex-wrap gap-2">
              <button onClick={() => setForm({ title: "", contentType: "Post", stream: "", channels: [], assigneeUserId: "", dueDate: "", brief: "", legalFlag: false, materials: [] })}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded px-4 py-2.5 shadow">
                + {t("New Assignment")}
              </button>
              {!chat && (
                <button onClick={() => setChat({ messages: [], busy: false, draft: null, materials: [], provider: "", pendingFile: null })}
                  className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow">
                  💡 {t("Suggest with AI")}
                </button>
              )}
            </span>
          ) : (
            <div className="space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">{t("New Assignment")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <span className="block text-slate-600 font-bold mb-1">{t("Title")}</span>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="finance-input w-full" />
                </div>
                <div>
                  <span className="block text-slate-600 font-bold mb-1">{t("Type")}</span>
                  <select value={form.contentType} onChange={e => setForm({ ...form, contentType: e.target.value })} className="finance-input w-full">
                    {CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                  </select>
                </div>
                <div>
                  <span className="block text-slate-600 font-bold mb-1">{t("Program")}</span>
                  <select value={form.stream} onChange={e => setForm({ ...form, stream: e.target.value })} className="finance-input w-full">
                    <option value="">—</option>
                    {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <span className="block text-slate-600 font-bold mb-1">{t("Assignee")}</span>
                  <select value={form.assigneeUserId} onChange={e => setForm({ ...form, assigneeUserId: e.target.value })} className="finance-input w-full">
                    <option value="">—</option>
                    {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
                <div>
                  <span className="block text-slate-600 font-bold mb-1">{t("Due")}</span>
                  <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="finance-input w-full" />
                </div>
                <div className="md:col-span-3">
                  <span className="block text-slate-600 font-bold mb-1">{t("Brief")}</span>
                  <textarea value={form.brief} onChange={e => setForm({ ...form, brief: e.target.value })} rows={2} className="finance-input w-full" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-600 font-bold">{t("Channels")}:</span>
                  {CONTENT_CHANNELS.map(ch => (
                    <label key={ch} className="flex items-center gap-1">
                      <input type="checkbox" checked={form.channels.includes(ch)}
                        onChange={e => setForm({ ...form, channels: e.target.checked ? [...form.channels, ch] : form.channels.filter((x: string) => x !== ch) })} />
                      {ch}
                    </label>
                  ))}
                </span>
                <label className="flex items-center gap-1 text-red-700 font-bold">
                  <input type="checkbox" checked={form.legalFlag} onChange={e => setForm({ ...form, legalFlag: e.target.checked })} />
                  <ShieldAlert className="h-3.5 w-3.5" /> {t("Legal review required")}
                </label>
              </div>
              {(form.materials || []).length > 0 && (
                <p className="text-[10px] text-slate-500">
                  📎 {form.materials.length} material(s) attached from the draft — {form.materials.map((m: any) => m.label).join(" · ").slice(0, 120)}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={async () => { if (await post("/api/content/save", form, `"${form.title}" assigned`)) setForm(null); }}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded px-4 py-2 shadow">{t("Save")}</button>
                <button onClick={() => setForm(null)} className="bg-slate-100 hover:bg-slate-200 rounded px-4 py-2">{t("Cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Register */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button onClick={() => setStatusFilter("")} className={`rounded-full px-3 py-1 ${!statusFilter ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>All ({(state.contentItems || []).length})</button>
          {CONTENT_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 ${statusFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
              {t(s)} ({(state.contentItems || []).filter(c => c.status === s).length})
            </button>
          ))}
        </div>

        {visible.length === 0 && <p className="text-xs text-slate-400 py-4">No content items yet — assignments come out of the daily production meeting.</p>}

        <div className="divide-y divide-slate-100">
          {visible.map(item => {
            const open = openId === item.id;
            const isAssignee = currentUser.id === item.assigneeUserId;
            const isChecker = currentUser.id === item.factCheckerUserId;
            const blockers = publishBlockers({ ...item, checksJson: JSON.stringify(item.checks || {}) });
            return (
              <div key={item.id} className="py-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 cursor-pointer" onClick={() => setOpenId(open ? null : item.id)}>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[item.status]}`}>{t(item.status)}</span>
                  <span className="font-bold text-slate-900">{item.title}</span>
                  <span className="text-slate-400">{item.contentType}{item.stream ? ` · ${item.stream}` : ""}</span>
                  {item.factCheckTag && <span className="text-emerald-700 flex items-center gap-0.5 text-[10px] font-bold"><CheckCircle2 className="h-3 w-3" /> {t("Fact-checked")}</span>}
                  {item.legalFlag && <span className="text-red-700 flex items-center gap-0.5 text-[10px] font-bold"><ShieldAlert className="h-3 w-3" /> {t("Legal review required")}</span>}
                  {item.corrections.length > 0 && <span className="text-amber-700 text-[10px] font-bold">{item.corrections.length} {t("Corrections")}</span>}
                  <span className="ml-auto text-slate-500 font-mono">{nameOf(item.assigneeUserId)}{item.dueDate ? ` · ${item.dueDate}` : ""}</span>
                </div>

                {open && (
                  <div className="mt-3 ml-1 pl-3 border-l-2 border-slate-200 space-y-3">
                    {item.brief && <p className="text-slate-600">{item.brief}</p>}
                    <p className="text-[10px] text-slate-400 font-mono">
                      {t("Channels")}: {item.channels.join(", ") || "—"} · daily meeting {item.assignedMeetingDate || "—"}
                      {item.reviewedMeetingDate && ` · weekly review ${item.reviewedMeetingDate}`}
                    </p>

                    {/* Reference material: links, photos, videos, documents */}
                    <div>
                      <h5 className="font-bold text-slate-700 uppercase text-[10px] mb-1">{t("Materials & References")}</h5>
                      {item.materials.length === 0 && <p className="text-slate-400">No materials attached.</p>}
                      {item.materials.map((m, i) => (
                        <p key={i} className="font-mono text-[11px] flex items-center gap-1.5">
                          <span>{MAT_ICON[m.kind] || "🔗"}</span>
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline truncate">{m.label}</a>
                          {canManage && item.status !== "Published" && (
                            <button onClick={() => saveItem(item, { materials: item.materials.filter((_, x) => x !== i) }, "Material removed")}
                              className="text-slate-400 hover:text-red-600" title="Remove">✕</button>
                          )}
                        </p>
                      ))}
                      {canManage && item.status !== "Published" && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          <input placeholder="Label" value={matForm.label} onChange={e => setMatForm({ ...matForm, label: e.target.value })} className="finance-input flex-1 min-w-[110px]" />
                          <input placeholder="URL" value={matForm.url} onChange={e => setMatForm({ ...matForm, url: e.target.value })} className="finance-input flex-1 min-w-[150px]" />
                          <select value={matForm.kind} onChange={e => setMatForm({ ...matForm, kind: e.target.value })} className="finance-input py-1" aria-label="Material kind">
                            <option value="link">🔗 Link</option>
                            <option value="photo">🖼 Photo</option>
                            <option value="video">🎬 Video</option>
                            <option value="doc">📄 Document</option>
                          </select>
                          <button onClick={async () => { if (!matForm.url.trim()) return; if (await saveItem(item, { materials: [...item.materials, { ...matForm, label: matForm.label || matForm.url }] }, "Material added")) setMatForm({ label: "", url: "", kind: "link" }); }}
                            className="bg-slate-900 hover:bg-slate-950 text-white rounded px-3 py-1.5">{t("Add Material")}</button>
                        </div>
                      )}
                    </div>

                    {/* Content standards — each checkbox is a policy sentence (Policy 002) */}
                    <div>
                      <h5 className="font-bold text-slate-700 uppercase text-[10px] mb-1">{t("Content Standards")}</h5>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {CONTENT_CHECKS.map(([key, label, sentence]) => (
                          <label key={key} title={sentence} className={`flex items-center gap-1 ${item.checks[key] ? "text-emerald-700" : "text-slate-500"}`}>
                            <input type="checkbox" checked={!!item.checks[key]}
                              disabled={!canManage || item.status === "Published"}
                              onChange={e => saveItem(item, { checks: { ...item.checks, [key]: e.target.checked } })} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Fact-check log (Policy 005: sources and verification steps) */}
                    <div>
                      <h5 className="font-bold text-slate-700 uppercase text-[10px] mb-1">
                        {t("Fact-Check Log")} {item.factCheckerUserId && <span className="normal-case font-normal">— {t("Fact-Checker")}: {nameOf(item.factCheckerUserId)}</span>}
                      </h5>
                      {item.factCheckLog.length === 0 && <p className="text-slate-400">No sources logged yet.</p>}
                      {item.factCheckLog.map((l, i) => (
                        <p key={i} className="font-mono text-[11px] text-slate-600">{l.date} — {l.source}{l.step ? ` · ${l.step}` : ""}</p>
                      ))}
                      {["In Production", "Fact-Check"].includes(item.status) && (isAssignee || isChecker || isEditor) && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          <input placeholder="Source" value={srcForm.source} onChange={e => setSrcForm({ ...srcForm, source: e.target.value })} className="finance-input flex-1 min-w-[140px]" />
                          <input placeholder="Verification step" value={srcForm.step} onChange={e => setSrcForm({ ...srcForm, step: e.target.value })} className="finance-input flex-1 min-w-[140px]" />
                          <button onClick={async () => { if (await post("/api/content/factcheck-log", { id: item.id, ...srcForm }, "Source recorded")) setSrcForm({ source: "", step: "" }); }}
                            className="bg-slate-900 hover:bg-slate-950 text-white rounded px-3 py-1.5">{t("Add Source")}</button>
                        </div>
                      )}
                    </div>

                    {/* Approvals (Policy 002: PM + PD, two distinct people) */}
                    <div>
                      <h5 className="font-bold text-slate-700 uppercase text-[10px] mb-1">{t("Approvals")}</h5>
                      <p className="font-mono text-[11px] text-slate-600">
                        Production Manager: {item.pmApprovedBy ? `✓ ${nameOf(item.pmApprovedBy)} (${item.pmApprovedAt.slice(0, 10)})` : "—"} ·
                        Programs Director: {item.pdApprovedBy ? `✓ ${nameOf(item.pdApprovedBy)} (${item.pdApprovedAt.slice(0, 10)})` : "—"}
                      </p>
                    </div>

                    {/* Legal attestation (Policy 002) */}
                    {item.legalFlag && (
                      <div>
                        <h5 className="font-bold text-red-700 uppercase text-[10px] mb-1">⚖ Legal Review</h5>
                        {item.legalReviewedBy
                          ? <p className="font-mono text-[11px] text-slate-600">Reviewed by {item.legalReviewedBy}{item.legalReviewNote ? ` — ${item.legalReviewNote}` : ""} (recorded by {nameOf(item.legalRecordedBy)}, {item.legalRecordedAt.slice(0, 10)})</p>
                          : ["Editorial Review", "Approved"].includes(item.status) && isEditor ? (
                            <div className="flex flex-wrap gap-2">
                              <input placeholder="Reviewed by (e.g. external counsel)" value={legalForm.by} onChange={e => setLegalForm({ ...legalForm, by: e.target.value })} className="finance-input flex-1 min-w-[180px]" />
                              <input placeholder="Note" value={legalForm.note} onChange={e => setLegalForm({ ...legalForm, note: e.target.value })} className="finance-input flex-1 min-w-[140px]" />
                              <button onClick={async () => { if (await post("/api/content/legal-record", { id: item.id, legalReviewedBy: legalForm.by, legalReviewNote: legalForm.note }, "Legal review recorded")) setLegalForm({ by: "", note: "" }); }}
                                className="bg-slate-900 hover:bg-slate-950 text-white rounded px-3 py-1.5">{t("Record Legal Review")}</button>
                            </div>
                          ) : <p className="text-slate-400">Not yet reviewed — required before publish.</p>}
                      </div>
                    )}

                    {/* Corrections (Policies 002 & 005: public, dated) */}
                    {item.status === "Published" && (
                      <div>
                        <h5 className="font-bold text-slate-700 uppercase text-[10px] mb-1">{t("Corrections")}</h5>
                        {item.corrections.map((c, i) => (
                          <p key={i} className="font-mono text-[11px] text-slate-600">{c.date} — {c.nature}: {c.correction} <span className="text-slate-400">({c.by})</span></p>
                        ))}
                        {isEditor && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            <input placeholder="Nature of the error" value={corrForm.nature} onChange={e => setCorrForm({ ...corrForm, nature: e.target.value })} className="finance-input flex-1 min-w-[160px]" />
                            <input placeholder="The correction" value={corrForm.correction} onChange={e => setCorrForm({ ...corrForm, correction: e.target.value })} className="finance-input flex-1 min-w-[160px]" />
                            <button onClick={async () => { if (await post("/api/content/correction", { id: item.id, ...corrForm }, "Correction issued")) setCorrForm({ nature: "", correction: "" }); }}
                              className="bg-amber-600 hover:bg-amber-700 text-white rounded px-3 py-1.5">{t("Add Correction")}</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions — status × role, server re-checks everything */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.status === "Assigned" && (isAssignee || canManage) && (
                        <button onClick={() => post("/api/content/start", { id: item.id }, "Production started")}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5">{t("Start Production")}</button>
                      )}
                      {item.status === "In Production" && (isAssignee || canManage) && (
                        <span className="flex flex-wrap items-center gap-1">
                          <select value={checkerPick} onChange={e => setCheckerPick(e.target.value)} className="finance-input py-1">
                            <option value="">{t("Fact-Checker")}…</option>
                            {activeUsers.filter(u => u.id !== item.assigneeUserId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                          <button onClick={() => post("/api/content/submit-factcheck", { id: item.id, factCheckerUserId: checkerPick }, "Sent to fact-check")}
                            className="bg-amber-600 hover:bg-amber-700 text-white rounded px-3 py-1.5">{t("Send to Fact-Check")}</button>
                        </span>
                      )}
                      {item.status === "Fact-Check" && isChecker && (
                        <button onClick={() => post("/api/content/factcheck-pass", { id: item.id }, "Fact-check passed")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5">{t("Pass Fact-Check")}</button>
                      )}
                      {(item.status === "Fact-Check" && (isChecker || isEditor)) || (item.status === "Editorial Review" && isEditor) ? (
                        <button onClick={() => { const reason = window.prompt("Reason for returning:"); if (reason) post("/api/content/return", { id: item.id, reason }, "Returned for revision"); }}
                          className="bg-slate-100 hover:bg-slate-200 rounded px-3 py-1.5">{t("Return for Revision")}</button>
                      ) : null}
                      {item.status === "Editorial Review" && isEditor && !isAssignee && (
                        <button onClick={() => post("/api/content/approve", { id: item.id }, "Approved")}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1.5">✓ {t("Approve")}</button>
                      )}
                      {item.status === "Approved" && isEditor && (
                        <button
                          onClick={() => post("/api/content/publish", { id: item.id }, "Published — fact-checked tag applied")}
                          disabled={blockers.length > 0}
                          title={blockers.join("\n")}
                          className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                          🚀 {t("Publish")}
                        </button>
                      )}
                      {item.status !== "Published" && isEditor && (
                        <button onClick={() => { if (window.confirm(`Remove "${item.title}"?`)) post("/api/content/delete", { id: item.id }, "Removed"); }}
                          className="text-red-600 hover:bg-red-50 rounded px-3 py-1.5">{t("Delete")}</button>
                      )}
                    </div>
                    {item.status === "Approved" && blockers.length > 0 && (
                      <ul className="text-[10px] text-red-600 list-disc ml-4">
                        {blockers.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
