import { useEffect, useMemo, useState } from "react";
import { Newspaper, ShieldAlert, CheckCircle2 } from "lucide-react";
import { ContentItem } from "../types";
import { STREAMS, CONTENT_STATUSES, CONTENT_TYPES, CONTENT_CHANNELS, CONTENT_CHECKS, publishBlockers } from "../constants";
import { SharedProps } from "./shared";
import Info from "../Info";
import { CONTENT_EDITORS, CREW } from "../roles";

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

const EDITOR_ROLES = CONTENT_EDITORS;

export default function EditorialTab({ state, currentUser, t, refreshState, triggerToast, phoneAccess, openDoc, lang, focusId, setFocusId }: SharedProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  // My Desk hands over the piece to open; consumed once so a later visit starts closed.
  useEffect(() => { if (focusId) { setOpenId(focusId); setFocusId(null); } }, [focusId]);
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
  const [pasteDraft, setPasteDraft] = useState({ label: "", kind: "Article Draft", text: "" });
  const [linkForm, setLinkForm] = useState({ url: "", description: "", kind: "link" });
  const [upDesc, setUpDesc] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libKind, setLibKind] = useState("");
  const [libSearch, setLibSearch] = useState("");
  const [libEdit, setLibEdit] = useState<null | { url: string; label: string; note: string }>(null);
  const [chatLib, setChatLib] = useState(false);   // library picker open inside the Idea Desk
  // Meeting recorder + minutes processing
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [mtgBusy, setMtgBusy] = useState(false);
  const [recHelp, setRecHelp] = useState(false); // mic unavailable → offer phone/browser link

  // Open the Idea Desk pre-seeded with a documented meeting topic. The user still
  // presses Send — no surprise model calls.
  const elaborateTopic = (mtg: { date: string; direction: string }, tp: { topic: string; note: string }) => {
    setChat({ messages: [], busy: false, draft: null, materials: [], provider: "", pendingFile: null });
    setChatInput(`${t("Topics discussed")} (${mtg.date}): ${tp.topic}${tp.note ? `\n${tp.note}` : ""}${mtg.direction ? `\n${t("Direction for the week")}: ${mtg.direction}` : ""}`);
  };

  // Save the form first (attendance/direction must survive), then process minutes.
  const processMinutes = async (form: any, viaAudio?: { base64: string; mimeType: string }) => {
    const kind = form.kind || "Weekly Editorial";
    setMtgBusy(true);
    try {
      await post("/api/meetings/save", { ...form, kind });
      const ok = await post(
        viaAudio ? "/api/meetings/transcribe" : "/api/meetings/extract-topics",
        viaAudio
          ? { kind, date: form.date, audio: viaAudio }
          : { kind, date: form.date, minutes: form.minutes },
        viaAudio ? "Recording transcribed — topics extracted" : "Topics extracted from minutes");
      if (ok) setMtgForm(null);
    } finally {
      setMtgBusy(false);
    }
  };

  // Read an audio file (Voice Memos export, WhatsApp voice note…) into the same
  // transcription pipeline as the live recorder.
  const uploadRecording = (form: any, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      processMinutes(form, { base64, mimeType: file.type || "audio/mp4" });
    };
    reader.readAsDataURL(file);
  };

  const toggleRecording = async (form: any) => {
    if (recorder) {
      recorder.stop();
      return;
    }
    // Phones over plain http (and the embedded pane) have no microphone API —
    // browsers only expose it on secure contexts. The upload path always works.
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecHelp(true);
      triggerToast("Live recording needs a secure connection — record with your phone's voice-memo app and use Upload Recording instead.", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop());
        setRecorder(null);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = String(reader.result).split(",")[1] || "";
          processMinutes(form, { base64, mimeType: blob.type });
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      setRecorder(rec);
      triggerToast("Recording — press Stop when the meeting ends");
    } catch {
      // Blocked mic (e.g. the in-app browser pane) → offer the LAN link/QR instead.
      setRecHelp(true);
      triggerToast("Microphone unavailable here — open the app on your phone or browser to record.", "error");
    }
  };

  const isEditor = EDITOR_ROLES.includes(currentUser.role);
  const canManage = isEditor || currentUser.role === "Project Officer"; // server scope-checks POs

  const nameOf = (id: string) => state.users.find(u => u.id === id)?.name || "—";
  const emailOf = (id: string) => state.users.find(u => u.id === id)?.email || "";
  const activeUsers = state.users.filter(u => u.active);

  // Google Calendar event-template URL: creating the event in Saad's Google account
  // with guests makes GOOGLE send the invitation emails and reminders — no OAuth,
  // no integration, works because the human is signed into Google in their browser.
  const gcalUrl = (title: string, date: string, details: string, guests: string[]) => {
    const d = date.replace(/-/g, "");
    const next = new Date(new Date(date + "T12:00:00Z").getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, "");
    const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${d}/${next}`, details });
    guests.filter(Boolean).forEach(g => p.append("add", g));
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
  };

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
      checks: item.checks, legalFlag: item.legalFlag, materials: item.materials,
      aiAssisted: item.aiAssisted, aiDisclosed: item.aiDisclosed, ...patch
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
      try {
        const base64 = String(reader.result).split(",")[1] || "";
        const res = await fetch("/api/document/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name, mimeType: file.type || "application/octet-stream",
            sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`,
            base64, category: "Reference Material",
            linkedRecordType: "Content Reference", linkedRecordId: "-",
            user: currentUser
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        const doc = data.doc || {};
        const kind = file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : "doc";
        setChat(c => c ? {
          ...c,
          materials: [...c.materials, { label: upDesc || file.name, url: doc.id ? `/api/document/content/${doc.id}` : file.name, kind, description: upDesc }],
          pendingFile: (file.type.startsWith("image/") || file.type === "application/pdf")
            ? { base64, mimeType: file.type, filename: file.name } : c.pendingFile
        } : c);
        setUpDesc("");
        triggerToast(`${file.name} → vault (${doc.refNo || doc.id || "saved"})`);
      } catch (err: any) {
        triggerToast(err?.message || "Upload failed", "error");
      }
    };
    reader.onerror = () => triggerToast(`Could not read ${file.name}.`, "error");
    reader.readAsDataURL(file);
  };

  const MAT_ICON: Record<string, string> = { link: "🔗", photo: "🖼", video: "🎬", doc: "📄" };

  // Live research on an item's open facts. Proposals only — a human logs what holds up.
  const [research, setResearch] = useState<null | { itemId: string; busy: boolean; findings: string; sources: { title: string; url: string }[] }>(null);

  const runResearch = async (item: ContentItem, mode: "sources" | "search" = "sources") => {
    setResearch({ itemId: item.id, busy: true, findings: "", sources: [] });
    try {
      const res = await fetch("/api/content/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, mode, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setResearch({ itemId: item.id, busy: false, findings: data.findings, sources: data.sources || [] });
    } catch (err: any) {
      triggerToast(err.message, "error");
      setResearch(null);
    }
  };

  // Drop a generated visual (or any reference file) straight onto an open item:
  // vault-filed, linked to the item, added to its materials. Watermark + AI flag
  // remain the human's Policy-021 steps.
  const uploadItemFile = (item: ContentItem, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result).split(",")[1] || "";
        const res = await fetch("/api/document/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name, mimeType: file.type || "application/octet-stream",
            sizeStr: `${Math.max(1, Math.round(file.size / 1024))} KB`,
            base64, category: "Reference Material",
            linkedRecordType: "Content", linkedRecordId: item.id,
            user: currentUser
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        const doc = data.doc || data.document || {};
        const kind = file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : "doc";
        await saveItem(item, { materials: [...item.materials, { label: file.name, url: doc.id ? `/api/document/content/${doc.id}` : file.name, kind }] },
          `${file.name} attached (${doc.refNo || "vaulted"})`);
      } catch (err: any) {
        triggerToast(err?.message || "Upload failed", "error");
      }
    };
    reader.onerror = () => triggerToast(`Could not read ${file.name}.`, "error");
    reader.readAsDataURL(file);
  };

  // Production studio: per-item drafting chat. Ephemeral thread; drafts persist
  // only when explicitly saved to the item.
  const [studio, setStudio] = useState<null | {
    itemId: string;
    messages: { role: string; text: string }[];
    busy: boolean;
    draft: { label: string; kind: string; text: string } | null;
    provider: string;
  }>(null);
  const [studioInput, setStudioInput] = useState("");

  const sendStudio = async (prefill?: string) => {
    if (!studio) return;
    const text = (prefill ?? studioInput).trim();
    if (!text || studio.busy) return;
    const messages = [...studio.messages, { role: "user", text }];
    setStudio({ ...studio, messages, busy: true });
    setStudioInput("");
    try {
      const res = await fetch("/api/content/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studio.itemId, messages, user: currentUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setStudio(s => s ? {
        ...s,
        messages: [...messages, { role: "assistant", text: data.reply }],
        busy: false,
        draft: data.draft || s.draft,
        provider: data.provider || s.provider
      } : s);
    } catch (err: any) {
      triggerToast(err.message, "error");
      setStudio(s => s ? { ...s, busy: false } : s);
    }
  };

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

  // Materials library — derived, never stored twice: every reference attached to any
  // content item, plus vault Reference Material from Idea Desk sessions that never
  // became an assignment (so nothing gathered along the way is lost).
  const library = useMemo(() => {
    const docById = new Map((state.documents || []).map(d => [d.id, d]));
    // Identical bytes are one entry: keyed by content hash where known, URL otherwise.
    const byKey = new Map<string, any>();
    const put = (key: string, entry: any) => {
      const prior = byKey.get(key);
      if (!prior) { byKey.set(key, { ...entry, copies: 1 }); return; }
      // Keep the entry that carries a source item; count the rest as copies.
      byKey.set(key, { ...(prior.itemTitle ? prior : entry), copies: prior.copies + 1 });
    };
    for (const c of state.contentItems || []) {
      for (const m of c.materials || []) {
        const docId = m.url.startsWith("/api/document/content/") ? m.url.split("/").pop() || "" : "";
        const doc = docId ? docById.get(docId) : undefined;
        put(doc?.contentHash || m.url, {
          ...m, itemId: c.id, itemTitle: c.title, itemStatus: c.status,
          docId, mimeType: doc?.mimeType, refNo: doc?.refNo || "",
          note: doc?.note || (m as any).description || "",
          date: (doc?.created_at || c.created_at || "").slice(0, 10)
        });
      }
    }
    for (const d of state.documents || []) {
      if (d.category !== "Reference Material") continue;
      // Registered links carry their destination in the pointer column; files are fetched by id.
      const isLink = (d.base64 || "").startsWith("link://");
      const url = isLink ? d.base64.slice("link://".length) : `/api/document/content/${d.id}`;
      put(d.contentHash || url, {
        label: d.filename, url,
        kind: isLink ? (/\.(jpe?g|png|gif|webp)([?#]|$)/i.test(url) ? "photo" : "link")
          : /^image\//.test(d.mimeType) ? "photo" : /^video\//.test(d.mimeType) ? "video" : "doc",
        itemTitle: "", docId: isLink ? "" : d.id, linkDocId: d.id,
        mimeType: d.mimeType, note: d.note || "",
        date: (d.created_at || "").slice(0, 10), refNo: d.refNo || ""
      });
    }
    return [...byKey.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [state.contentItems, state.documents]);

  // Open a library material with the right handler for its kind.
  const openMaterial = (m: any) => {
    if (m.docId) openDoc({ id: m.docId, filename: m.label, mimeType: m.mimeType });
    else window.open(m.url, "_blank");
  };

  // Reuse anything from the library in a new idea conversation.
  const useInIdeaDesk = (m: any) => {
    const material = { label: m.label, url: m.url, kind: m.kind, description: m.note || "" };
    setChat(c => c
      ? { ...c, materials: c.materials.some(x => x.url === m.url) ? c.materials : [...c.materials, material] }
      : { messages: [], busy: false, draft: null, materials: [material], provider: "", pendingFile: null });
    triggerToast(`${m.label} → ${t("Idea Desk")}`);
  };

  // Rename / re-describe: vault files carry it on the document, links on their item.
  const saveMaterialMeta = async (m: any, label: string, note: string) => {
    const docId = m.docId || m.linkDocId;   // links are vault entries too, just not files
    if (docId) {
      if (await post("/api/documents/meta", { id: docId, filename: label, note }, "Renamed")) setLibEdit(null);
      return;
    }
    const item = (state.contentItems || []).find(c => c.id === m.itemId);
    if (!item) { triggerToast("This material has no item to update.", "error"); return; }
    const materials = item.materials.map(x => x.url === m.url ? { ...x, label, description: note } : x);
    if (await saveItem(item, { materials }, "Renamed")) setLibEdit(null);
  };

  const libVisible = library.filter(m =>
    (!libKind || m.kind === libKind) &&
    (!libSearch || `${m.label} ${m.description || ""} ${m.itemTitle || ""}`.toLowerCase().includes(libSearch.toLowerCase())));

  // Meetings of the last 7 days (both kinds — Policy 002 defines the weekly editorial
  // AND the daily production meeting), plus older history. Rows come date-desc.
  const ago7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const allMtgs = state.editorialMeetings || [];
  const recentMtgs = allMtgs.filter(m => m.date >= ago7);
  const pastMtgs = allMtgs.filter(m => m.date < ago7).slice(0, 3);
  // Policy 002 participants per meeting kind, preticked on a fresh attendance sheet.
  const policyAttendeesFor = (kind: string) => activeUsers
    .filter(u => (kind === "Daily Production"
      ? [...CREW, "Production Manager", "Project Officer", "Super Admin"]
      : [...CONTENT_EDITORS, "Project Officer"]).includes(u.role))
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
        <h3 className="text-sm font-bold text-slate-800 uppercase font-mono mb-3 flex items-center justify-between">
          <span>📅 {t("Editorial Meetings")}</span>
          <a href="/api/calendar.ics" download className="text-[10px] font-sans normal-case bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2.5 py-1">
            ⬇ {t("Download calendar (.ics)")}
          </a>
        </h3>

        {/* Held meetings of the last 7 days: attendance, direction, topics per meeting */}
        {!mtgForm && recentMtgs.map(m => (
          <div key={m.id} className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.kind === "Daily Production" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{t(m.kind)}</span>
              <span className="font-bold text-slate-800">{m.date}</span>
              <span className="text-slate-500">{t("Attendance")}:</span>
              {m.attendees.map(id => (
                <span key={id} className="bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-[10px]">{nameOf(id)}</span>
              ))}
              <span className="ml-auto flex gap-1.5">
                <button
                  title={t("Add to Google Calendar")}
                  onClick={() => window.open(gcalUrl(
                    `AnaHon — ${m.kind} Meeting`, m.date,
                    [m.direction && `Direction: ${m.direction}`,
                     m.topics.length ? `Topics: ${m.topics.map(tp => tp.topic + (tp.assigneeName ? ` → ${tp.assigneeName}` : "")).join("; ")}` : ""]
                      .filter(Boolean).join("\n"),
                    m.attendees.map(emailOf)), "_blank")}
                  className="text-[10px] bg-slate-200 hover:bg-slate-300 rounded px-2 py-1">📅 Google</button>
                {canRecordMeeting && (
                  <button onClick={() => setMtgForm({ id: m.id, kind: m.kind, date: m.date, attendees: [...m.attendees], direction: m.direction, notes: m.notes, minutes: m.minutes })}
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 rounded px-2 py-1">{t("Edit Meeting")}</button>
                )}
              </span>
            </div>
            {m.direction && <p><span className="font-bold text-slate-600">{t("Direction for the week")}:</span> {m.direction}</p>}
            {m.notes && <p><span className="font-bold text-slate-600">{t("Decisions & notes")}:</span> {m.notes}</p>}
            {m.topics.length > 0 && (
              <div>
                <span className="font-bold text-slate-600">{t("Topics discussed")}:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {m.topics.map((tp, i) => (
                    <span key={i} title={tp.note} className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-full px-2.5 py-1">
                      {tp.topic}
                      {tp.assigneeName && <span className="text-[10px] text-indigo-700 font-bold">→ {tp.assigneeName}</span>}
                      {canManage && (
                        <>
                          <button onClick={() => elaborateTopic(m, tp)}
                            className="text-[10px] bg-slate-900 text-white rounded-full px-2 py-0.5 hover:bg-slate-700">💡 {t("Elaborate")}</button>
                          <button
                            title={t("New Assignment")}
                            onClick={() => setForm({
                              title: tp.topic, contentType: "Post", stream: "", channels: [],
                              assigneeUserId: tp.assigneeUserId || "", dueDate: "",
                              brief: `${tp.note}${tp.note ? "\n" : ""}(${t("Topics discussed")} — ${m.date})`,
                              legalFlag: false, materials: []
                            })}
                            className="text-[10px] bg-red-600 text-white rounded-full px-2 py-0.5 hover:bg-red-700">➕</button>
                        </>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {m.minutes && (
              <details className="text-[11px]">
                <summary className="cursor-pointer font-bold text-slate-600">{t("Minutes / Transcript")} ({m.minutes.length.toLocaleString()} chars)</summary>
                <p className="whitespace-pre-wrap text-slate-600 max-h-48 overflow-y-auto mt-1 p-2 bg-white border border-slate-200 rounded">{m.minutes}</p>
              </details>
            )}
            <p className="text-[10px] text-slate-400">{t("Recorded by")} {nameOf(m.recordedBy)}</p>
          </div>
        ))}
        {!mtgForm && canRecordMeeting && (
          <button onClick={() => setMtgForm({ kind: "Weekly Editorial", date: today, attendees: policyAttendeesFor("Weekly Editorial"), direction: "", notes: "", minutes: "" })}
            className="mb-4 bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2 shadow">
            📝 {t("Record a Meeting")}
          </button>
        )}
        {mtgForm && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-600">{t("Type")}</span>
              <select value={mtgForm.kind} disabled={!!mtgForm.id} aria-label={t("Type")}
                onChange={e => setMtgForm({ ...mtgForm, kind: e.target.value, attendees: policyAttendeesFor(e.target.value) })}
                className="finance-input py-1">
                <option value="Weekly Editorial">{t("Weekly Editorial")}</option>
                <option value="Daily Production">{t("Daily Production")}</option>
              </select>
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
            <div>
              <span className="block font-bold text-slate-600 mb-1">{t("Minutes / Transcript")}</span>
              <textarea value={mtgForm.minutes || ""} onChange={e => setMtgForm({ ...mtgForm, minutes: e.target.value })} rows={4} className="finance-input w-full font-mono text-[11px]" placeholder={t("Paste transcript or minutes here…")} />
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <button onClick={() => processMinutes(mtgForm)} disabled={mtgBusy || !(mtgForm.minutes || "").trim()}
                  className="bg-slate-900 hover:bg-slate-950 disabled:opacity-40 text-white rounded px-3 py-1.5">
                  🧠 {t("Extract Topics")}
                </button>
                <button onClick={() => toggleRecording(mtgForm)} disabled={mtgBusy}
                  className={`${recorder ? "bg-red-600 animate-pulse" : "bg-slate-200 hover:bg-slate-300 text-slate-800"} ${recorder ? "text-white" : ""} rounded px-3 py-1.5 disabled:opacity-40`}>
                  {recorder ? `⏹ ${t("Stop Recording")}` : `🎙 ${t("Record Meeting")}`}
                </button>
                <label className={`bg-slate-200 hover:bg-slate-300 text-slate-800 rounded px-3 py-1.5 cursor-pointer ${mtgBusy ? "opacity-40 pointer-events-none" : ""}`}>
                  ⬆ {t("Upload Recording")}
                  <input type="file" accept="audio/*" className="hidden" disabled={mtgBusy}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadRecording(mtgForm, f); e.target.value = ""; }} />
                </label>
                {mtgBusy && <span className="text-slate-500 animate-pulse">{t("Transcribing…")}</span>}
                <button onClick={() => setRecHelp(v => !v)} title={t("Record from your phone")}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 rounded px-2.5 py-1.5">📱</button>
                <span className="text-[9px] text-slate-400">Zoom/Meet: download their transcript and paste it — no integration needed. Recordings are archived in the vault.</span>
              </div>
              {recHelp && (
                <div className="mt-2 p-3 bg-white border border-slate-300 rounded-lg flex flex-wrap items-center gap-4">
                  <div className="text-[11px] space-y-1 flex-1 min-w-[220px]">
                    <p className="font-bold text-slate-700">{t("Record from your phone")}</p>
                    {phoneAccess && phoneAccess.urls.length > 0 ? (
                      <>
                        <p className="font-mono text-sm font-bold text-slate-900 break-all">{phoneAccess.urls[0].url}</p>
                        <button onClick={() => { navigator.clipboard?.writeText(phoneAccess.urls[0].url); triggerToast("Address copied."); }}
                          className="bg-slate-900 hover:bg-slate-950 text-white rounded px-2.5 py-1 text-[10px]">{t("Copy")}</button>
                        <p className="text-slate-500">On a phone: record the meeting with the voice-memo app, then open this address, sign in, and use ⬆ Upload Recording (live 🎙 needs https, which phones refuse on plain local addresses). On this machine: open the address in Chrome/Safari and press 🎙 there.</p>
                      </>
                    ) : (
                      <p className="text-slate-500">Open the same address in Chrome/Safari on this machine and press 🎙 there — the microphone is blocked in this window.</p>
                    )}
                  </div>
                  {phoneAccess?.qr && (
                    <div className="w-28 h-28 shrink-0 [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: phoneAccess.qr }} />
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { if (await post("/api/meetings/save", { ...mtgForm, kind: mtgForm.kind || "Weekly Editorial" }, "Meeting recorded")) setMtgForm(null); }}
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
              <span key={m.id} className="mr-3 font-mono">{m.date} ({t(m.kind)}){m.direction ? ` — ${m.direction.slice(0, 60)}${m.direction.length > 60 ? "…" : ""}` : ""}</span>
            ))}
          </div>
        )}
      </div>

      {/* Idea desk — brainstorm chat; AI prefills, only a human saves (house rule) */}
      {canManage && chat && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false);
            try {
              const files = Array.from(e.dataTransfer.files);
              if (files.length) {
                files.forEach((f: File) => uploadChatFile(f));
                return;
              }
              // No files: a link/image dragged from a web page arrives as a URL.
              const url = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")).trim().split("\n")[0];
              if (url && /^https?:\/\//.test(url)) {
                const label = upDesc || url;
                setChat(c => c ? { ...c, materials: [...c.materials, { label, url, kind: /\.(jpe?g|png|gif|webp)([?#]|$)/i.test(url) ? "photo" : "link", description: upDesc }] } : c);
                setUpDesc("");
                triggerToast("Link attached.");
                post("/api/materials/link", { url, label, note: upDesc });  // → library
              }
            } catch (err: any) {
              triggerToast(err?.message || "Drop failed", "error");
            }
          }}
          className={`p-5 bg-slate-900 text-white border rounded-xl shadow-lg space-y-3 ${dragOver ? "border-red-500 border-2 border-dashed" : "border-slate-800"}`}>
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
                  setForm({ title: chat.draft.title, contentType: chat.draft.contentType, stream: chat.draft.stream, channels: chat.draft.channels, assigneeUserId: "", dueDate: "", brief, legalFlag: chat.draft.legalFlag, materials: chat.draft.materials, aiAssisted: true });
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
                onClick={async () => {
                  const url = linkForm.url.trim();
                  if (!url) return;
                  const label = linkForm.description || url;
                  setChat(c => c ? { ...c, materials: [...c.materials, { label, url, kind: linkForm.kind, description: linkForm.description }] } : c);
                  setLinkForm({ url: "", description: "", kind: "link" });
                  // Register it in the vault so it joins the library immediately,
                  // whether or not this idea ever becomes an assignment.
                  await post("/api/materials/link", { url, label, note: linkForm.description });
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs rounded px-3 py-1.5">+ {t("Add Material")}</button>
            </div>
          </div>

          {/* Section 2b — reuse anything already in the library */}
          <div>
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              📚 {t("From Library")} <span className="normal-case font-normal">({library.length})</span>
            </span>
            {!chatLib ? (
              <button onClick={() => setChatLib(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs rounded px-3 py-1.5">
                📚 {t("Add from Library")}
              </button>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-2">
                <div className="flex gap-2">
                  <input value={libSearch} onChange={e => setLibSearch(e.target.value)}
                    placeholder={t("Search materials…")} aria-label={t("Search materials…")}
                    className="flex-1 bg-slate-900 text-xs px-2 py-1 rounded text-white border border-slate-800 outline-none" />
                  <button onClick={() => setChatLib(false)} className="text-slate-400 hover:text-white text-xs px-2">✕</button>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 max-h-44 overflow-y-auto">
                  {libVisible.map((m, i) => {
                    const attached = chat.materials.some(x => x.url === m.url);
                    return (
                      <button key={i} onClick={() => useInIdeaDesk(m)} disabled={attached} title={`${m.label}${m.note ? ` — ${m.note}` : ""}`}
                        className={`border rounded overflow-hidden text-left ${attached ? "border-emerald-600 opacity-60" : "border-slate-700 hover:border-slate-500"}`}>
                        {m.kind === "photo" ? (
                          <img src={m.url} alt={m.label} className="h-12 w-full object-cover bg-slate-800"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="h-12 w-full bg-slate-800 flex items-center justify-center text-lg">{MAT_ICON[m.kind] || "🔗"}</div>
                        )}
                        <p className="text-[9px] p-1 truncate text-slate-300">{attached ? "✓ " : ""}{m.label}</p>
                      </button>
                    );
                  })}
                  {libVisible.length === 0 && <p className="col-span-6 text-[10px] text-slate-500 p-2">Nothing in the library matches.</p>}
                </div>
              </div>
            )}
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
              <span className="text-[9px] text-slate-500">{t("or drag files anywhere onto this panel")} → vault · Reference Material{chat.pendingFile ? ` · 👁 ${chat.pendingFile.filename} will be shown to the model` : ""}</span>
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
                <button onClick={async () => {
                  if (await post("/api/content/save", form, `"${form.title}" assigned`)) {
                    // Assignment with a person + deadline → hand Google a ready event with
                    // the assignee as guest; saving it there sends their invite + reminders.
                    if (form.assigneeUserId && form.dueDate) {
                      window.open(gcalUrl(`Due: ${form.title}`, form.dueDate,
                        `${form.contentType} · ${form.stream || "—"}\n${(form.brief || "").slice(0, 300)}`,
                        [emailOf(form.assigneeUserId)]), "_blank");
                      triggerToast("Google Calendar opened — save the event there to send the reminder.");
                    }
                    setForm(null);
                  }
                }}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded px-4 py-2 shadow">{t("Save")}</button>
                <button onClick={() => setForm(null)} className="bg-slate-100 hover:bg-slate-200 rounded px-4 py-2">{t("Cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Materials library — everything gathered along the way, in one place */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <button onClick={() => setLibOpen(v => !v)}
          className="flex w-full items-center justify-between text-sm font-bold text-slate-800 uppercase font-mono">
          <span>📚 {t("Materials Library")} <span className="text-slate-400 normal-case font-sans font-normal">({library.length})</span></span>
          <span className="text-slate-400">{libOpen ? "▾" : "▸"}</span>
        </button>

        {libOpen && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input value={libSearch} onChange={e => setLibSearch(e.target.value)}
                placeholder={t("Search materials…")} className="finance-input flex-1 min-w-[160px] py-1" />
              {[["", "All"], ["photo", "🖼"], ["video", "🎬"], ["link", "🔗"], ["doc", "📄"]].map(([k, label]) => (
                <button key={k} onClick={() => setLibKind(k)}
                  className={`rounded-full px-3 py-1 ${libKind === k ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
                  {label} {k ? library.filter(m => m.kind === k).length : library.length}
                </button>
              ))}
            </div>

            {libVisible.length === 0 && (
              <p className="text-xs text-slate-400 py-3">
                Nothing here yet — materials attached in the Idea Desk or on a content item collect in this library.
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {libVisible.map((m, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden hover:border-slate-400 hover:shadow-sm transition-all flex flex-col">
                  <button onClick={() => openMaterial(m)} className="text-left" title={t("Open")}>
                    {m.kind === "photo" ? (
                      <img src={m.url} alt={m.label} className="h-24 w-full object-cover bg-slate-100"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="h-24 w-full bg-slate-50 flex items-center justify-center text-3xl">{MAT_ICON[m.kind] || "🔗"}</div>
                    )}
                  </button>

                  {libEdit?.url === m.url ? (
                    <div className="p-2 space-y-1">
                      <input value={libEdit.label} onChange={e => setLibEdit({ ...libEdit, label: e.target.value })}
                        aria-label={t("Name")} className="finance-input w-full text-[11px] py-1" />
                      <input value={libEdit.note} onChange={e => setLibEdit({ ...libEdit, note: e.target.value })}
                        placeholder={t("Description")} aria-label={t("Description")} className="finance-input w-full text-[10px] py-1" />
                      <span className="flex gap-1">
                        <button onClick={() => saveMaterialMeta(m, libEdit.label, libEdit.note)}
                          className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-0.5 text-[10px]">{t("Save")}</button>
                        <button onClick={() => setLibEdit(null)}
                          className="bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 text-[10px]">{t("Cancel")}</button>
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 space-y-0.5 flex-1 flex flex-col">
                      <p className="text-[11px] font-bold text-slate-800 truncate" title={m.label}>{m.label}</p>
                      {m.note && <p className="text-[10px] text-slate-500 truncate" title={m.note}>{m.note}</p>}
                      <p className="text-[9px] text-slate-400 truncate">
                        {m.itemTitle ? `→ ${m.itemTitle}` : t("Idea Desk session")}{m.date ? ` · ${m.date}` : ""}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400 truncate">
                        {m.refNo}{m.copies > 1 ? `  ·  ${m.copies}× ${t("copies merged")}` : ""}
                      </p>
                      {canManage && (
                        <span className="flex gap-1 pt-1 mt-auto">
                          <button onClick={() => useInIdeaDesk(m)} title={t("Use in Idea Desk")}
                            className="bg-slate-900 hover:bg-slate-700 text-white rounded px-2 py-0.5 text-[10px]">💡</button>
                          <button onClick={() => setLibEdit({ url: m.url, label: m.label, note: m.note || "" })} title={t("Rename")}
                            className="bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 text-[10px]">✏️</button>
                          <a href={m.url} download={m.label} onClick={e => e.stopPropagation()} title={t("Download")}
                            className="bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 text-[10px]">⬇</a>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
                <div className="flex flex-wrap items-center gap-2 cursor-pointer"
                  onClick={() => {
                    // Collapsing the row unmounts the studio with it — same warning.
                    if (open && studio?.itemId === item.id && studio.draft
                      && !window.confirm(t("You have a draft that is not saved to this story yet. Close and lose it?"))) return;
                    setOpenId(open ? null : item.id);
                  }}>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[item.status]}`}>{t(item.status)}</span>
                  <span className="font-bold text-slate-900">{item.title}</span>
                  <span className="text-slate-400">{item.contentType}{item.stream ? ` · ${item.stream}` : ""}</span>
                  {item.factCheckTag && <span className="text-emerald-700 flex items-center gap-0.5 text-[10px] font-bold"><CheckCircle2 className="h-3 w-3" /> {t("Fact-checked")}</span>}
                  {item.legalFlag && <span className="text-red-700 flex items-center gap-0.5 text-[10px] font-bold"><ShieldAlert className="h-3 w-3" /> {t("Legal review required")}</span>}
                  {item.aiAssisted && <span className="text-indigo-700 text-[10px] font-bold" title={t("AI used")}>🤖 AI{item.aiDisclosed ? " ✓" : ""}</span>}
                  {item.drafts.length > 0 && (
                    <span className="text-slate-600 text-[10px] font-bold bg-slate-100 rounded-full px-2 py-0.5" title={item.drafts.map(d => d.label).join(" · ")}>
                      📝 {item.drafts.length} {t("Drafts")}
                    </span>
                  )}
                  {item.materials.length > 0 && (
                    <span className="text-slate-500 text-[10px]" title={item.materials.map(m => m.label).join(" · ")}>
                      📎 {item.materials.length}
                    </span>
                  )}
                  {item.corrections.length > 0 && <span className="text-amber-700 text-[10px] font-bold">{item.corrections.length} {t("Corrections")}</span>}
                  {item.websiteUrl && !item.retractedAt && (
                    <a href={item.websiteUrl} target="_blank" rel="noopener" onClick={ev => ev.stopPropagation()}
                      className="text-sky-700 text-[10px] font-bold underline" title={item.websiteUrl}>🔗 {t("View on website")}</a>
                  )}
                  {item.retractedAt && <span className="text-red-700 text-[10px] font-bold" title={item.retractReason}>⛔ {t("Retracted from website")} {item.retractedAt.slice(0, 10)}</span>}
                  <span className="ml-auto text-slate-500 font-mono">{nameOf(item.assigneeUserId)}{item.dueDate ? ` · ${item.dueDate}` : ""}</span>
                </div>

                {open && (
                  <div
                    className="mt-3 ml-1 pl-3 border-l-2 border-slate-200 space-y-3"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const working = ["Assigned", "In Production", "Fact-Check"].includes(item.status);
                      const allowed = isAssignee || isChecker || canManage;
                      if (!working || !allowed) return;
                      Array.from(e.dataTransfer.files).forEach((f: File) => uploadItemFile(item, f));
                    }}>
                    {item.brief && <p className="text-slate-600">{item.brief}</p>}
                    <p className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-2">
                      <span>
                        {t("Channels")}: {item.channels.join(", ") || "—"} · daily meeting {item.assignedMeetingDate || "—"}
                        {item.reviewedMeetingDate && ` · weekly review ${item.reviewedMeetingDate}`}
                      </span>
                      {item.dueDate && item.status !== "Published" && (
                        <button
                          title={t("Add to Google Calendar")}
                          onClick={() => window.open(gcalUrl(
                            `Due: ${item.title}`, item.dueDate,
                            `${item.contentType} · ${item.stream || "—"}\n${(item.brief || "").slice(0, 300)}`,
                            [emailOf(item.assigneeUserId), emailOf(item.factCheckerUserId)]), "_blank")}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2 py-0.5">📅 Google</button>
                      )}
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

                    {/* Production studio + drafts — what gets written here is what fact-check verifies */}
                    {(() => {
                      const working = ["Assigned", "In Production", "Fact-Check"].includes(item.status);
                      const canProduce = isAssignee || isChecker || canManage;
                      return (
                        <div>
                          <h5 className="font-bold text-slate-700 uppercase text-[10px] mb-1">{t("Drafts")} ({item.drafts.length})</h5>
                          {item.drafts.map((d, i) => (
                            <details key={i} className="mb-1 text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1">
                              <summary className="cursor-pointer flex items-center gap-2">
                                <span className="font-bold">{d.label}</span>
                                <span className="bg-slate-200 rounded-full px-2 py-0.5 text-[9px]">{d.kind}</span>
                                <span className="text-slate-400 text-[9px]">{d.date} · {d.by}</span>
                              </summary>
                              <p className="whitespace-pre-wrap text-slate-700 max-h-64 overflow-y-auto my-1">{d.text}</p>
                              <span className="flex gap-2">
                                <button onClick={() => { navigator.clipboard?.writeText(d.text); triggerToast("Draft copied."); }}
                                  className="bg-slate-900 text-white rounded px-2 py-0.5 text-[10px]">{t("Copy")}</button>
                                {working && canProduce && (
                                  <button onClick={() => post("/api/content/draft-delete", { id: item.id, index: i }, "Draft removed")}
                                    className="text-red-600 hover:bg-red-50 rounded px-2 py-0.5 text-[10px]">{t("Delete")}</button>
                                )}
                              </span>
                            </details>
                          ))}
                          {/* Written elsewhere? Attach it without the AI — the fact-checker
                              reads the Drafts list, not the materials list. */}
                          {working && canProduce && (
                            <details className="mb-1.5">
                              <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-800">✎ {t("Paste a draft written elsewhere")}</summary>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <input placeholder={t("Label")} value={pasteDraft.label} onChange={e => setPasteDraft({ ...pasteDraft, label: e.target.value })} className="finance-input flex-1 min-w-[120px]" />
                                <select value={pasteDraft.kind} onChange={e => setPasteDraft({ ...pasteDraft, kind: e.target.value })} aria-label={t("Type")} className="finance-input py-1">
                                  {["Article Draft", "Script", "Outline", "Carousel", "Caption", "Questions", "Other"].map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                                <textarea placeholder={t("Paste the text…")} value={pasteDraft.text} onChange={e => setPasteDraft({ ...pasteDraft, text: e.target.value })} rows={3} className="finance-input w-full" />
                                <button
                                  onClick={async () => {
                                    if (!pasteDraft.text.trim() || !pasteDraft.label.trim()) { triggerToast("Give the draft a label and its text.", "error"); return; }
                                    if (await post("/api/content/draft-save", { id: item.id, ...pasteDraft }, `Saved to "${item.title}"`)) setPasteDraft({ label: "", kind: "Article Draft", text: "" });
                                  }}
                                  className="bg-slate-900 hover:bg-slate-950 text-white rounded px-3 py-1.5">💾 {t("Save Draft to Item")}</button>
                              </div>
                            </details>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            {item.coverPath
                              ? <img src={`/api/cover/${item.id}?v=${encodeURIComponent(item.coverPath)}`} alt="" className="h-16 w-28 object-cover rounded border border-slate-200" title={item.coverProvider} />
                              : <span className="text-slate-400">{t("No cover yet")}</span>}
                            {canProduce && !item.retractedAt && (<>
                              <button onClick={() => post("/api/content/cover", { id: item.id, provider: "higgsfield" }, "Cover generated with Higgsfield")}
                                className="bg-slate-900 hover:bg-slate-950 text-white rounded px-3 py-1.5">🖼 {t("Cover: Higgsfield")}</button>
                              <button onClick={() => post("/api/content/cover", { id: item.id, provider: "gemini" }, "Cover generated with Gemini")}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 rounded px-3 py-1.5">{t("Cover: Gemini")}</button>
                              <label className="cursor-pointer underline text-slate-600">{t("Upload cover")}
                                <input type="file" accept="image/*" className="hidden" onChange={async ev => {
                                  const f = ev.target.files?.[0]; if (!f) return;
                                  const b64 = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
                                  const up: any = await fetch("/api/document/upload", { method: "POST", headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ filename: f.name, mimeType: f.type, sizeStr: `${Math.round(f.size / 1024)} KB`, base64: b64, category: "Cover", linkedRecordType: "Content", linkedRecordId: item.id }) }).then(r => r.json());
                                  const docId = up.doc?.id || up.document?.id || up.id;
                                  if (docId) await post("/api/content/cover", { id: item.id, docId }, "Cover set"); else triggerToast(up.error || "Upload failed");
                                }} />
                              </label>
                            </>)}
                          </div>
                          {working && canProduce && studio?.itemId !== item.id && (
                            <span className="flex flex-wrap gap-1.5">
                              <button onClick={() => { setStudio({ itemId: item.id, messages: [], busy: false, draft: null, provider: "" }); setStudioInput(""); }}
                                className="bg-slate-900 hover:bg-slate-950 text-white rounded px-3 py-1.5">🎬 {t("Production Studio")}</button>
                              {/* Policy 021 bridge: concept out, generated file dragged back onto this drawer. */}
                              <button onClick={() => {
                                navigator.clipboard?.writeText(`${item.title}\n\n${item.brief}`);
                                triggerToast("Concept copied — paste it into Higgsfield, then drag the result back onto this item.");
                                window.open("https://higgsfield.ai", "_blank");
                              }}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 rounded px-3 py-1.5">🎨 Higgsfield</button>
                            </span>
                          )}
                          {studio?.itemId === item.id && (
                            <div className="mt-2 p-3 bg-slate-900 text-white rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold uppercase text-[10px] font-mono">🎬 {t("Production Studio")}</span>
                                <span className="flex items-center gap-3">
                                  {studio.provider && <span className="text-[9px] text-slate-400 font-mono">{t("Provided by")} {studio.provider}</span>}
                                  <button
                                    onClick={() => {
                                      // Studio conversations are not persisted — warn before a ready draft is lost.
                                      if (studio.draft && !window.confirm(t("You have a draft that is not saved to this story yet. Close and lose it?"))) return;
                                      setStudio(null);
                                    }}
                                    className="text-slate-400 hover:text-white text-[10px]">✕</button>
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  [t("Draft Article"), `Write the full ${item.contentType === "Article" ? "article" : "piece"} draft for this item, using the brief and materials.`],
                                  [t("Carousel"), "Suggest a carousel post for this item: numbered slides, short text per slide, hook first, CTA last."],
                                  [t("Single-image Post"), "Suggest a single-image post: caption with hashtags for our channels, and which provided photo to use."],
                                  [t("Script"), "Write the production script for this item: scenes, VO lines, and where each provided material appears."]
                                ].map(([label, msg]) => (
                                  <button key={label} disabled={studio.busy} onClick={() => sendStudio(msg)}
                                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-full px-2.5 py-1 text-[10px]">{label}</button>
                                ))}
                              </div>
                              <div className="space-y-1.5 max-h-64 overflow-y-auto text-[11px]">
                                {studio.messages.map((m, i) => (
                                  <div key={i} className={`p-2 rounded whitespace-pre-wrap ${m.role === "user" ? "bg-red-600/20 border border-red-600/30 ml-6" : "bg-slate-800 border border-slate-700 mr-6"}`}>{m.text}</div>
                                ))}
                                {studio.busy && <p className="text-slate-400 animate-pulse text-[10px]">Producing…</p>}
                              </div>
                              {studio.draft && (
                                <div className="p-2 bg-emerald-950/60 border border-emerald-700 rounded text-[11px] space-y-1">
                                  <p className="font-bold text-emerald-300">{studio.draft.label} <span className="font-normal">({studio.draft.kind})</span></p>
                                  <p className="whitespace-pre-wrap text-slate-300 max-h-40 overflow-y-auto">{studio.draft.text}</p>
                                  <button onClick={async () => { if (await post("/api/content/draft-save", { id: item.id, ...studio.draft }, `${studio.draft.label} → "${item.title.slice(0, 40)}${item.title.length > 40 ? "…" : ""}"`)) setStudio(s => s ? { ...s, draft: null } : s); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 rounded px-2.5 py-1 text-[10px] font-semibold">💾 {t("Save Draft to Item")}</button>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <textarea value={studioInput} onChange={e => setStudioInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendStudio(); } }}
                                  rows={2} placeholder={t("What should the studio produce or edit?")}
                                  className="flex-1 bg-slate-950 text-[11px] px-2.5 py-1.5 rounded text-white border border-slate-800 outline-none resize-none" />
                                <button onClick={() => sendStudio()} disabled={studio.busy || !studioInput.trim()}
                                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded px-3 text-[11px] font-semibold shrink-0">{t("Send")}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Golden transparency rule: AI use must be labeled on the published piece */}
                    {(item.aiAssisted || (canManage && item.status !== "Published")) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        <label className={`flex items-center gap-1 font-bold ${item.aiAssisted ? "text-indigo-700" : "text-slate-500"}`}>
                          <input type="checkbox" checked={item.aiAssisted}
                            disabled={!canManage || item.status === "Published" || item.drafts.length > 0}
                            title={item.drafts.length > 0 ? "Saved AI drafts keep this on." : ""}
                            onChange={e => saveItem(item, { aiAssisted: e.target.checked, aiDisclosed: e.target.checked ? item.aiDisclosed : false })} />
                          🤖 {t("AI used")}
                        </label>
                        {item.aiAssisted && (
                          <label className={`flex items-center gap-1 ${item.aiDisclosed ? "text-emerald-700" : "text-red-700 font-bold"}`}>
                            <input type="checkbox" checked={item.aiDisclosed}
                              disabled={!canManage || item.status === "Published"}
                              onChange={e => saveItem(item, { aiDisclosed: e.target.checked })} />
                            {t("AI-use disclaimer applied to the published piece")}
                          </label>
                        )}
                      </div>
                    )}

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

                    {/* Facts still to verify — derived from the [FILL: …] markers the AI
                        leaves on unverified claims. The markers become the reporting list. */}
                    {(() => {
                      const text = [item.brief, ...item.drafts.map(d => d.text)].join("\n");
                      const facts = [...new Set([...text.matchAll(/\[FILL:\s*([^\]]+)\]/g)].map(m => m[1].trim()))];
                      if (!facts.length) return null;
                      return (
                        <div>
                          <h5 className="font-bold text-amber-700 uppercase text-[10px] mb-1">
                            ⓘ {t("Facts still to verify")} ({facts.length})
                          </h5>
                          <ul className="text-[11px] text-slate-600 list-disc ml-4">
                            {facts.map((f, i) => <li key={i}>{f}</li>)}
                          </ul>
                          <p className="text-[9px] text-slate-400 mt-0.5">{t("Each becomes a source entry below once confirmed (Policy 005).")}</p>

                          {(isAssignee || isChecker || canManage) && ["In Production", "Fact-Check"].includes(item.status) && (
                            <span className="flex flex-wrap items-center gap-1.5 mt-1">
                              <button onClick={() => runResearch(item, "sources")} disabled={research?.busy || item.materials.filter(m => /^https?:\/\//.test(m.url)).length === 0}
                                title={t("Reads only the links attached to this story — no open search")}
                                className="bg-slate-900 hover:bg-slate-950 disabled:opacity-40 text-white rounded px-3 py-1.5 text-[11px]">
                                📖 {research?.itemId === item.id && research.busy ? t("Researching…") : t("Read my sources")}
                                <span className="opacity-60"> · {item.materials.filter(m => /^https?:\/\//.test(m.url)).length} · ~$0.10</span>
                              </button>
                              <button onClick={() => { if (window.confirm(t("Open web search costs roughly ten times more than reading your own sources. Continue?"))) runResearch(item, "search"); }}
                                disabled={research?.busy}
                                className="bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 rounded px-3 py-1.5 text-[11px]">
                                🌐 {t("Search the web")} <span className="opacity-60">· ~$2</span>
                              </button>
                            </span>
                          )}

                          {research?.itemId === item.id && !research.busy && (
                            <div className="mt-2 p-2 bg-white border border-slate-300 rounded text-[11px] space-y-2">
                              <p className="whitespace-pre-wrap text-slate-700 max-h-64 overflow-y-auto">{research.findings}</p>
                              {research.sources.length > 0 && (
                                <div>
                                  <p className="font-bold text-slate-600">{t("Sources found")} ({research.sources.length}) — {t("log the ones that hold up")}</p>
                                  {research.sources.map((s, i) => (
                                    <p key={i} className="flex items-center gap-1.5 py-0.5">
                                      <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline truncate flex-1">{s.title}</a>
                                      <button onClick={() => post("/api/content/factcheck-log", { id: item.id, source: s.title, step: s.url }, "Source logged")}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-0.5 text-[10px] shrink-0">+ {t("Log")}</button>
                                    </p>
                                  ))}
                                </div>
                              )}
                              <p className="text-[9px] text-amber-700">{t("AI research — verify each source before logging it (Policy 005).")}</p>
                              <button onClick={() => setResearch(null)} className="text-slate-500 hover:text-slate-800 text-[10px]">✕ {t("Close")}</button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                            {!item.retractedAt && (
                              <button onClick={async () => {
                                const reason = window.prompt(t("Why is this piece being retracted from the website? (public record)"));
                                if (reason) await post("/api/content/retract", { id: item.id, reason }, "Retracted from the website");
                              }} className="ml-2 border border-red-300 text-red-700 rounded px-3 py-1.5 hover:bg-red-50">⛔ {t("Retract from website")}</button>
                            )}
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
                        <><button onClick={() => post("/api/content/approve", { id: item.id }, "Approved")}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded px-3 py-1.5">✓ {t("Approve")}</button><Info id="content-approve" lang={lang} /></>
                      )}
                      {item.status === "Approved" && isEditor && (
                        <><button
                          onClick={() => post("/api/content/publish", { id: item.id }, "Published — fact-checked tag applied")}
                          disabled={blockers.length > 0}
                          title={blockers.join("\n")}
                          className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                          🚀 {t("Publish")}
                        </button><Info id="two-approvers" lang={lang} /></>
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
