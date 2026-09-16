import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageCircleQuestion, X, CornerDownLeft, ArrowRight, RotateCcw, History, Trash2, Mic, Square, Volume2, VolumeX } from "lucide-react";
import { CONFIRM_ROUTES, type Proposal } from "./anna";
import { voiceSupported, record, clipBase64, speak, hush, type Recording } from "./annaVoice";

/**
 * The floating question box, on every screen.
 *
 * It answers from the system's own writing — the Q&A, the desk rules, the door list and
 * the table that decides who may call what — for the role the asker is in right now. Two
 * things it deliberately does not do: it does not guess when the material is silent (it
 * says so and names the seat to ask), and it does not describe where to go. When the
 * answer has a door, the reply carries a button that opens it.
 */
type Reply = { answer: string; door: string | null; askSeat: string | null };
type Turn = { q: string; reply?: Reply; error?: string };

/** "Policy P5, Section 7.2" inside an answer, turned into a link that opens that
 *  chapter on the Policies & Handbooks door — the citation rule in helpBot.ts made
 *  clickable, not a second source of truth about what a policy says. */
const POLICY_CITE = /Policy\s+(P\d{1,2}|\d{3})\b(?:,?\s*(?:Section|§)\s*[\d.]+)?/g;
function citeLinks(text: string, onOpenDoor: (navKey: string, focus?: string) => void) {
  const parts: (string | ReactNode)[] = [];
  let last = 0, key = 0, m: RegExpExecArray | null;
  POLICY_CITE.lastIndex = 0;
  while ((m = POLICY_CITE.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <button key={key++} onClick={() => onOpenDoor("handbooks", `policy:${m![1]}`)}
        className="font-semibold text-[#6D1A1A] underline decoration-dotted hover:text-[#4A1010]">
        {m[0]}
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** **bold** from the model, then policy citations inside each piece. Nothing else is parsed. */
function rich(text: string, onOpenDoor: (navKey: string, focus?: string) => void) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? <strong key={i}>{citeLinks(part, onOpenDoor)}</strong> : <span key={i}>{citeLinks(part, onOpenDoor)}</span>);
}

/* ── Anna (src/anna.ts). Each finished turn is saved on the server in Saad's own chat
   (decision B); the page keeps nothing in browser storage. Past chats open read-only for
   their cards: a card's buttons belong to the turn that made it, so an old draft cannot be
   confirmed twice. Actions are navigation only — a door or a record — and run once on arrival. */
type NavAction = { type: "open_door"; door: string } | { type: "open_record"; kind: string; id: string };
type AnnaAction = NavAction | { type: "proposal"; proposal: Proposal };
type CardState = "open" | "saving" | "saved" | "gone" | { error: string };
/** Where a saved draft lives, for the button after Confirm. */
const DRAFT_DOOR: Record<string, string> = { quotation: "production", task: "mydesk", request: "help" };
type AnnaMsg = { role: "user" | "assistant"; content: string; actions?: AnnaAction[]; usd?: number; error?: boolean; past?: boolean };
type ChatRow = { id: string; title: string; updatedAt: string };
/** The open chat survives closing the panel (the component unmounts), not a reload. */
let openChatId = "";
/** On a phone the keyboard would cover the panel and the mic; focus the box only with a mouse. */
const focusBox = (el: HTMLTextAreaElement | null) => { if (!window.matchMedia?.("(pointer: coarse)").matches) el?.focus(); };
/** Voice choices last only as long as the page, like the open chat: no browser storage. */
let voiceLangPick: "en" | "ar" | "" = "";
let readAloud = false;
type VoiceState = "idle" | "listening" | "sending" | { note: string };
const KIND_LABEL: Record<string, string> = {
  voucher: "Voucher", quotation: "Quotation", project: "Project", client: "Client",
  vendor: "Supplier", document: "Document", task: "Task", engagement: "Event",
};

function AnnaChat({ t, lang, voiceReady, doorLabel, onOpenDoor, onOpenRecord, onEditDraft }: {
  t: (s: string) => string;
  lang: string;
  voiceReady: boolean;
  doorLabel: (navKey: string) => string;
  onOpenDoor: (navKey: string, focus?: string) => void;
  onOpenRecord: (kind: string, id: string) => void;
  onEditDraft: (kind: string, data: Record<string, any>) => void;
}) {
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [msgs, setMsgs] = useState<AnnaMsg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatId, setChatId] = useState(openChatId);
  const [list, setList] = useState<ChatRow[] | null>(null);   // null = the conversation, not the list
  const [listErr, setListErr] = useState("");
  const [voice, setVoice] = useState<VoiceState>("idle");
  const [level, setLevel] = useState(0);
  const [vLang, setVLang] = useState<"en" | "ar">(voiceLangPick || (lang === "ar" ? "ar" : "en"));
  const [aloud, setAloud] = useState(readAloud);
  const recRef = useRef<Recording | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { openChatId = chatId; }, [chatId]);
  useEffect(() => { voiceLangPick = vLang; }, [vLang]);
  useEffect(() => { readAloud = aloud; if (!aloud) hush(); }, [aloud]);
  // Closing the panel ends a recording (nothing is sent) and any speech.
  useEffect(() => () => { recRef.current?.cancel(); hush(); }, []);

  /** Tap: start. Tap again: stop and send. The clip also ends itself when Saad goes quiet. */
  const mic = async () => {
    if (voice === "listening") { recRef.current?.stop(); return; }
    if (busy || voice === "sending") return;
    if (!voiceReady) { setVoice({ note: t("Voice is not set up yet.") }); return; }
    if (!voiceSupported()) { setVoice({ note: t("Voice needs the secure address of the app (https) on a recent browser.") }); return; }
    hush();
    try {
      recRef.current = await record(setLevel, async clip => {
        recRef.current = null;
        if (!clip) { setVoice({ note: t("I didn't hear anything.") }); return; }
        setVoice("sending");
        try {
          const r = await fetch("/api/anna/listen", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lang: vLang, audio: { mimeType: clip.type, base64: await clipBase64(clip) } }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || t("I couldn't hear that. Try again."));
          const words = String(d.transcript || "").trim();
          if (!words) { setVoice({ note: t("I didn't catch that. Try again.") }); return; }
          setVoice("idle");
          send(words);
        } catch (e: any) { setVoice({ note: e.message }); }
      });
      setVoice("listening");
    } catch {
      setVoice({ note: t("The microphone is not allowed. Allow it for this app, then try again.") });
    }
  };
  useEffect(() => { if (chatId) openChat(chatId); else focusBox(inputRef.current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const showList = async () => {
    setListErr("");
    try {
      const r = await fetch("/api/anna/chats");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setList(d.chats || []);
    } catch (e: any) { setList([]); setListErr(e.message || t("Could not load past chats.")); }
  };
  const openChat = async (id: string) => {
    try {
      const r = await fetch(`/api/anna/chats/${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsgs((d.chat.messages || []).map((m: AnnaMsg) => ({ ...m, past: true })));
      setCards({}); setChatId(id); setList(null);
    } catch {
      // A chat deleted elsewhere: start clean rather than show an error on open.
      setChatId(""); setMsgs([]); setList(null);
    }
  };
  const newChat = () => { setMsgs([]); setCards({}); setQ(""); setChatId(""); setList(null); focusBox(inputRef.current); };
  const remove = async (id: string | null) => {
    if (!window.confirm(id ? t("Delete this chat? This cannot be undone.") : t("Delete all your chats with Anna? This cannot be undone."))) return;
    try {
      const r = await fetch("/api/anna/chats/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || t("Could not delete."));
      if (!id || id === chatId) { setChatId(""); setMsgs([]); setCards({}); }
      setList(l => (id ? (l || []).filter(c => c.id !== id) : []));
    } catch (e: any) { setListErr(e.message); }
  };
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  const run = (a: NavAction) => a.type === "open_door" ? onOpenDoor(a.door) : onOpenRecord(a.kind, a.id);

  /** Confirm: the one place a card writes, through the existing route, as Saad. A quotation is
   *  always a Draft; a contract card has no Confirm at all; any other route is refused here. */
  const confirm = async (key: string, p: Proposal) => {
    if (!(CONFIRM_ROUTES as readonly string[]).includes(p.confirmRoute) || p.confirmRoute === "form:contract") return;
    setCards(c => ({ ...c, [key]: "saving" }));
    try {
      const body = p.kind === "quotation" ? { ...p.data, status: "Draft" } : p.data;
      const r = await fetch(p.confirmRoute, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Drafted-By": "anna" }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || t("Could not save."));
      setCards(c => ({ ...c, [key]: "saved" }));
    } catch (e: any) {
      setCards(c => ({ ...c, [key]: { error: e.message } }));
    }
  };

  const send = async (spoken?: string) => {
    const text = (spoken ?? q).trim();
    if (!text || busy) return;
    const history = [...msgs.filter(m => !m.error), { role: "user" as const, content: text }];
    if (spoken === undefined) setQ("");
    setMsgs(prev => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const r = await fetch("/api/anna/turn", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, messages: history.map(m => ({ role: m.role, content: m.content })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("Anna could not answer just now."));
      const actions: AnnaAction[] = Array.isArray(d.actions) ? d.actions : [];
      if (d.chatId) setChatId(d.chatId);
      if (readAloud && d.answer) speak(String(d.answer));
      setMsgs(prev => [...prev, { role: "assistant", content: String(d.answer || ""), actions, usd: d.usage?.usd }]);
      actions.forEach(a => { if (a.type !== "proposal") run(a); });
    } catch (e: any) {
      // A failed turn is shown but never sent back as history; the question stays so it can be retried.
      setMsgs(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], error: true }, { role: "assistant", content: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  if (list) return (
    <>
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="pb-1 text-[12px] font-bold text-slate-700">{t("Past chats")}</p>
        {listErr && <p className="text-[12px] text-red-700">{listErr}</p>}
        {!list.length && !listErr && <p className="text-[12px] text-slate-500">{t("No saved chats yet.")}</p>}
        {list.map(c => (
          <div key={c.id} className={`flex items-center gap-1 rounded-lg ${c.id === chatId ? "bg-[#F88888]/15" : "hover:bg-slate-100"}`}>
            <button onClick={() => openChat(c.id)} className="min-h-[44px] min-w-0 flex-1 px-2 text-start">
              <span className="block truncate text-[13px] text-slate-900">{c.title || t("Untitled")}</span>
              <span dir="ltr" className="block text-[10px] text-slate-400">{c.updatedAt.slice(0, 16).replace("T", " ")}</span>
            </button>
            <button onClick={() => remove(c.id)} title={t("Delete this chat")} aria-label={t("Delete this chat")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-2">
        <button onClick={() => setList(null)} className="min-h-[44px] rounded-lg px-3 text-[12px] font-bold text-[#6D1A1A] hover:bg-[#6D1A1A]/5">
          {t("Back")}
        </button>
        {!!list.length && (
          <button onClick={() => remove(null)} className="min-h-[44px] rounded-lg px-3 text-[12px] font-bold text-red-700 hover:bg-red-50">
            {t("Delete all chats")}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!msgs.length && (
          <p className="text-[12px] leading-relaxed text-slate-500">
            {t("Ask Anna to find, check or open something: what is waiting on you, a quotation, a project's spend, what a policy says.")}
          </p>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <p key={i} className="ms-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[#F88888]/20 px-3 py-1.5 text-[13px] leading-relaxed text-slate-900">{m.content}</p>
        ) : m.error ? (
          <p key={i} className="w-fit max-w-[95%] rounded-2xl bg-red-50 px-3 py-1.5 text-[13px] leading-relaxed text-red-800">{m.content}</p>
        ) : (
          <div key={i} className="w-fit max-w-[95%] space-y-1.5 rounded-2xl bg-slate-100 px-3 py-2">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{rich(m.content, onOpenDoor)}</p>
            {(m.actions || []).map((a, k) => a.type === "proposal" ? (() => {
              const key = `${i}:${k}`, st = cards[key] || "open", p = a.proposal;
              if (st === "gone") return <p key={k} className="text-[11px] text-slate-400">{t("Discarded")}</p>;
              return (
                <div key={k} className="space-y-1.5 rounded-xl border border-[#E6D3CA] bg-white p-2.5">
                  {p.lines.map((l, n) => <p key={n} className={`text-[12px] leading-snug ${n ? "text-slate-600" : "font-bold text-slate-900"}`}>{l}</p>)}
                  {m.past ? (
                    <p className="text-[11px] text-slate-400">{t("From an earlier session — ask Anna again to act on it.")}</p>
                  ) : st === "saved" ? (
                    <button onClick={() => onOpenDoor(DRAFT_DOOR[p.kind])}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white">
                      {t("Saved")} · {t("Open")} {doorLabel(DRAFT_DOOR[p.kind])} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {p.confirmRoute !== "form:contract" && (
                        <button onClick={() => confirm(key, p)} disabled={st === "saving"}
                          className="min-h-[36px] rounded-lg bg-[#6D1A1A] px-3 text-[11px] font-bold text-white transition-colors hover:bg-[#4A1010] disabled:opacity-50">
                          {st === "saving" ? t("Saving…") : t("Confirm")}
                        </button>
                      )}
                      {p.kind !== "request" && (
                        <button onClick={() => onEditDraft(p.kind, p.data)}
                          className="min-h-[36px] rounded-lg border border-[#6D1A1A] px-3 text-[11px] font-bold text-[#6D1A1A] transition-colors hover:bg-[#6D1A1A]/5">
                          {p.kind === "contract" ? t("Open the form") : t("Edit")}
                        </button>
                      )}
                      <button onClick={() => setCards(c => ({ ...c, [key]: "gone" }))} disabled={st === "saving"}
                        className="min-h-[36px] rounded-lg px-3 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100">
                        {t("Discard")}
                      </button>
                    </div>
                  )}
                  {typeof st === "object" && <p className="text-[11px] text-red-700">{st.error}</p>}
                </div>
              );
            })() : (
              <button key={k} onClick={() => run(a)}
                className="me-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#6D1A1A] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#4A1010]">
                {t("Open")} {a.type === "open_door" ? doorLabel(a.door) : t(KIND_LABEL[a.kind] || a.kind)} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </button>
            ))}
            {typeof m.usd === "number" && <p dir="ltr" className="text-end text-[10px] text-slate-400">≈ ${m.usd.toFixed(3)}</p>}
          </div>
        ))}
        {busy && <p className="w-fit rounded-2xl bg-slate-100 px-3 py-1.5 text-[13px] text-slate-600">{t("Anna is looking…")}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 px-2 pt-1.5 text-[11px] text-slate-500">
        <div role="radiogroup" aria-label={t("Speaking language")} className="flex overflow-hidden rounded-md border border-slate-300">
          {(["en", "ar"] as const).map(l => (
            <button key={l} role="radio" aria-checked={vLang === l} onClick={() => setVLang(l)} disabled={voice === "listening"}
              className={`min-h-[28px] px-2 font-bold ${vLang === l ? "bg-[#6D1A1A] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {l === "en" ? "EN" : "عربي"}
            </button>
          ))}
        </div>
        <button onClick={() => setAloud(a => !a)} aria-pressed={aloud}
          className={`inline-flex min-h-[28px] items-center gap-1 rounded-md px-1.5 font-bold ${aloud ? "text-[#6D1A1A]" : "text-slate-500"} hover:bg-slate-100`}>
          {aloud ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {t("Read answers aloud")}
        </button>
        <span role="status" className="min-w-0 flex-1 truncate text-end">
          {voice === "listening" ? t("Listening… tap to stop") : voice === "sending" ? t("Writing down what you said…") : typeof voice === "object" ? voice.note : ""}
        </span>
      </div>
      <div className="flex items-end gap-2 p-2">
        <button
          onClick={showList} disabled={busy}
          title={t("Past chats")} aria-label={t("Past chats")}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
        >
          <History className="h-4 w-4" />
        </button>
        <button
          onClick={newChat}
          disabled={busy || !msgs.length}
          title={t("New conversation")} aria-label={t("New conversation")}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <textarea
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={2}
          placeholder={t("Ask Anna…")}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none transition-colors focus:border-[#6D1A1A]"
        />
        <button
          onClick={mic}
          disabled={busy || voice === "sending"}
          aria-label={voice === "listening" ? t("Stop and send") : t("Speak to Anna")}
          aria-pressed={voice === "listening"}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-colors disabled:opacity-40 ${voice === "listening" ? "border-[#6D1A1A] bg-[#6D1A1A]/10 text-[#6D1A1A]" : "border-slate-300 text-slate-600 hover:bg-slate-100"} ${voiceReady ? "" : "opacity-60"}`}
        >
          {voice === "listening" ? (
            <span aria-hidden className="flex h-5 items-center gap-[3px]">
              {[0.6, 1, 0.8].map((k, i) => (
                <span key={i} className="w-[3px] rounded-full bg-[#6D1A1A]" style={{ height: `${Math.max(3, Math.round(20 * Math.min(1, level * k * 1.6)))}px` }} />
              ))}
              <Square className="ms-1 h-2.5 w-2.5 fill-current" />
            </span>
          ) : <Mic className="h-4 w-4" />}
        </button>
        <button
          onClick={() => send()}
          disabled={busy || !q.trim()}
          aria-label={t("Send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#6D1A1A] text-white transition-colors hover:bg-[#4A1010] disabled:opacity-40"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export default function HelpDesk({
  t, lang, rtl, doorLabel, onOpenDoor, openSignal, anna = false, annaVoice = false, onOpenRecord = () => {}, onEditDraft = () => {},
}: {
  t: (s: string) => string;
  lang: string;
  rtl: boolean;
  doorLabel: (navKey: string) => string;
  onOpenDoor: (navKey: string, focus?: string) => void;
  // A door screen asking to open this widget with a chapter already in the question —
  // "Ask about this policy" (Policies & Handbooks). Bump the nonce to reopen with the
  // same context twice; the question still goes out through the same /api/help/ask call.
  openSignal?: { context: string; nonce: number } | null;
  /** Anna's tab, for the accounts on her list (state.anna.enabled). */
  anna?: boolean;
  /** Whether the server has its speech key (state.anna.voice). */
  annaVoice?: boolean;
  onOpenRecord?: (kind: string, id: string) => void;
  onEditDraft?: (kind: string, data: Record<string, any>) => void;
}) {
  const [open, setOpen] = useState(false);
  // Anna opens first for the people who have her; the help desk is one tap away. A policy
  // question from a door screen ("Ask about this policy") always lands on the help desk.
  const [mode, setMode] = useState<"anna" | "help">(anna ? "anna" : "help");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && mode === "help") inputRef.current?.focus(); }, [open, mode]);
  useEffect(() => { if (!anna) setMode("help"); }, [anna]);
  useEffect(() => {
    if (!openSignal) return;
    setOpen(true);
    setMode("help");
    setQ(prev => prev || `${openSignal.context} — `);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal?.nonce]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setTurns(prev => [...prev, { q: question }]);
    setBusy(true);
    try {
      const r = await fetch("/api/help/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t("The help desk could not answer just now."));
      setTurns(prev => prev.map((x, i) => (i === prev.length - 1 ? { ...x, reply: d as Reply } : x)));
    } catch (e: any) {
      setTurns(prev => prev.map((x, i) => (i === prev.length - 1 ? { ...x, error: e.message } : x)));
    } finally {
      setBusy(false);
    }
  };

  // Positioned against the content column, not the viewport. That column is flex-1
  // beside the sidebar, so its left edge moves while the sidebar's width animates and
  // this travels with it — no transition here, and nothing to tell it the sidebar's
  // state. It also cannot cover the navigation, because it is no longer over it.
  // Resting: the same raise the door tiles use, so it reads as part of the system.
  // z-[95] keeps it beside the "N missing" pill and under that drawer's backdrop
  // (z-[96]) — the column is `relative` with no z-index, so it is a containing block
  // but not a stacking context, and this still competes on z with the whole page.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-float="help"
        title={t("Ask for help")}
        aria-label={t("Ask for help")}
        className="absolute bottom-5 start-5 md:start-8 z-[95] flex h-12 w-12 items-center justify-center rounded-full bg-[#6D1A1A] text-white shadow-lg shadow-[#6D1A1A]/25 transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[#4A1010] hover:shadow-xl hover:shadow-[#6D1A1A]/30"
      >
        <MessageCircleQuestion className="h-5 w-5" />
      </button>
    );
  }

  // Open: the panel is 335px wide on a phone and the "N missing" pill sits in the
  // opposite bottom corner — measured, the panel covered it whole (106x36) and the pill
  // could not be clicked. The overlap exists on any viewport under 498px, so the panel
  // lifts clear until `lg` and drops back to the launcher's corner above it. Height is
  // not fixed (Arabic wraps differently), so this raises the bottom, never the top.
  // `lg` and not `sm`: from `md` the panel starts at the content edge (288px), which at
  // 768-771px puts its right edge back under the pill. Measured, not guessed.
  return (
    <div
      ref={boxRef}
      dir={rtl ? "rtl" : "ltr"}
      className="absolute bottom-24 start-5 md:start-8 z-[95] flex max-h-[70vh] w-[min(22rem,100%-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[#E6D3CA] bg-white shadow-2xl shadow-[#4A1010]/20 lg:bottom-5"
    >
      <div className="flex items-center justify-between gap-2 bg-[#6D1A1A] ps-3 pe-1.5 py-1.5 text-white">
        {anna ? (
          <div role="tablist" className="flex items-center gap-1">
            {(["anna", "help"] as const).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`min-h-[36px] rounded-lg px-3 text-xs font-bold transition-colors ${mode === m ? "bg-white text-[#6D1A1A]" : "text-white/80 hover:bg-white/15"}`}>
                {m === "anna" ? "Anna" : t("Help")}
              </button>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs font-bold">
            <MessageCircleQuestion className="h-4 w-4" /> {t("Ask for help")}
          </p>
        )}
        <button onClick={() => setOpen(false)} aria-label={t("Close")} className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-white/15">
          <X className="h-4 w-4" />
        </button>
      </div>

      {mode === "anna" && anna ? (
        <AnnaChat t={t} lang={lang} voiceReady={annaVoice} doorLabel={doorLabel} onOpenDoor={onOpenDoor} onOpenRecord={onOpenRecord} onEditDraft={onEditDraft} />
      ) : (<>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!turns.length && (
          <p className="text-[12px] leading-relaxed text-slate-500">
            {t("Ask how something works, where to find it, whether you are allowed to do it, or what a row on your desk means.")}
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="space-y-1.5">
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl bg-[#F88888]/20 px-3 py-1.5 text-[13px] leading-relaxed text-slate-900">{turn.q}</p>
            {turn.error ? (
              <p className="w-fit max-w-[95%] rounded-2xl bg-red-50 px-3 py-1.5 text-[13px] leading-relaxed text-red-800">{turn.error}</p>
            ) : turn.reply ? (
              <div className="w-fit max-w-[95%] space-y-1.5 rounded-2xl bg-slate-100 px-3 py-2">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{citeLinks(turn.reply.answer, onOpenDoor)}</p>
                {turn.reply.door && (
                  <button
                    onClick={() => { onOpenDoor(turn.reply!.door!); setOpen(false); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#6D1A1A] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#4A1010]"
                  >
                    {t("Open")} {doorLabel(turn.reply.door)} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </button>
                )}
                {turn.reply.askSeat && (
                  <p className="text-[11px] text-slate-600">{t("Ask")}: {t(turn.reply.askSeat)}</p>
                )}
              </div>
            ) : (
              <p className="w-fit rounded-2xl bg-slate-100 px-3 py-1.5 text-[13px] text-slate-600">{t("Reading the handbook…")}</p>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-slate-200 p-2">
        <textarea
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          rows={2}
          placeholder={t("How do I…?")}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 px-2.5 py-2 text-[13px] outline-none transition-colors focus:border-[#6D1A1A]"
        />
        <button
          onClick={ask}
          disabled={busy || !q.trim()}
          aria-label={t("Send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#6D1A1A] text-white transition-colors hover:bg-[#4A1010] disabled:opacity-40"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
      </>)}
    </div>
  );
}
