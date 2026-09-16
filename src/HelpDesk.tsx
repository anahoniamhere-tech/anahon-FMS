import { useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { MessageCircleQuestion, X, CornerDownLeft, ArrowRight, RotateCcw, History, Trash2, Mic, Square, MoreHorizontal } from "lucide-react";
import { CONFIRM_ROUTES, type Proposal } from "./anna";
import AnnaGuide, { type Guide } from "./AnnaGuide";
import AnnaRecorder from "./AnnaRecorder";
import { voiceSupported, record, clipBase64, speak, hush, unlockVoice, type Recording } from "./annaVoice";

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

/* ── Floating Anna (stage C). When her panel is closed, the launcher is Anna herself: drag her
   anywhere over the screen, tap to open the chat, or tap her mic to open it already listening.
   Where she rests is remembered on this device only, as fractions of the content column so a
   rotated phone or a resized window keeps her on screen. */
const ORB_KEY = "anna-orb-position";
type OrbAt = { fx: number; fy: number };
const readOrb = (): OrbAt | null => {
  try {
    const v = JSON.parse(localStorage.getItem(ORB_KEY) || "null");
    return v && Number.isFinite(v.fx) && Number.isFinite(v.fy) ? { fx: Math.min(1, Math.max(0, v.fx)), fy: Math.min(1, Math.max(0, v.fy)) } : null;
  } catch { return null; }
};
const ORB = 48, ORB_MARGIN = 12;

/* ── Anna's waveform (stage D): how she is doing, at a glance, on the floating button and in
   the panel's header. Listening follows the microphone; thinking, speaking and opening a
   screen each have their own beat; with reduced motion the bars stand still. */
type AnnaMood = "idle" | "listening" | "thinking" | "speaking" | "opening";
const WAVE_SHAPE = [0.35, 0.65, 1, 0.65, 0.35];
const WAVE_BEAT: Record<AnnaMood, string> = {
  idle: "", listening: "",
  thinking: "animate-[anna-wave_1.4s_ease-in-out_infinite]",
  speaking: "animate-[anna-wave_0.55s_ease-in-out_infinite]",
  opening: "animate-[anna-wave_0.3s_ease-in-out_infinite]",
};
const MOOD_LABEL: Record<AnnaMood, string> = {
  idle: "Anna is ready", listening: "Anna is listening", thinking: "Anna is thinking",
  speaking: "Anna is speaking", opening: "Anna is opening a screen",
};
function AnnaWave({ mood, level = 0, t, className = "" }: { mood: AnnaMood; level?: number; t: (s: string) => string; className?: string }) {
  return (
    <span role="img" aria-label={t(MOOD_LABEL[mood])} data-anna-mood={mood} className={`flex h-5 items-center gap-[3px] ${className}`}>
      {WAVE_SHAPE.map((k, i) => (
        <span key={i}
          className={`h-full w-[3px] origin-center rounded-full bg-current motion-reduce:animate-none ${WAVE_BEAT[mood]}`}
          style={{
            transform: `scaleY(${mood === "listening" ? Math.max(0.15, Math.min(1, level * 1.6 * k)) : mood === "idle" ? k * 0.7 : k})`,
            animationDelay: `${i * 90}ms`,
          }} />
      ))}
    </span>
  );
}

/* ── Anna (src/anna.ts). Each finished turn is saved on the server in Saad's own chat
   (decision B); the page keeps nothing in browser storage. Past chats open read-only for
   their cards: a card's buttons belong to the turn that made it, so an old draft cannot be
   confirmed twice. Actions are navigation only — a door or a record — and run once on arrival. */
type NavAction = { type: "open_door"; door: string } | { type: "open_record"; kind: string; id: string };
type AnnaAction = NavAction | { type: "proposal"; proposal: Proposal } | { type: "choice"; options: string[] } | ({ type: "guide" } & Guide);
type CardState = "open" | "saving" | "saved" | "gone" | { error: string };
/** Where a saved draft lives, for the button after Confirm. */
const DRAFT_DOOR: Record<string, string> = { quotation: "production", client: "production", task: "mydesk", request: "help" };
type AnnaMsg = { role: "user" | "assistant"; content: string; actions?: AnnaAction[]; usd?: number; error?: boolean; past?: boolean; local?: boolean };
type ChatRow = { id: string; title: string; updatedAt: string };
/** The open chat survives closing the panel (the component unmounts), not a reload. */
let openChatId = "";
/** On a phone the keyboard would cover the panel and the mic; focus the box only with a mouse. */
const focusBox = (el: HTMLTextAreaElement | null) => { if (!window.matchMedia?.("(pointer: coarse)").matches) el?.focus(); };
/** Voice choices last only as long as the page, like the open chat: no browser storage. */
let voiceLangPick: "en" | "ar" | "" = "";
let listenHandled = 0;
/** Saying one of these ends a talk (Anna still answers it). */
const BYE = /\b(bye|goodbye|good night|that'?s all|thanks?,? anna|thank you,? anna)\b|باي|مع السلامة|شكرا(ً)?,? (يا )?(anna|آنا)/i;
/** The line Anna opens with. Local and free: no API call. */
const greeting = (lang: string, name: string) => {
  const first = name.trim().split(/\s+/)[0] || "";
  return lang === "ar" ? `أهلاً${first ? ` ${first}` : ""}، كيف بقدر ساعدك؟` : `Hi${first ? ` ${first}` : ""}, how can I help?`;
};
type VoiceState = "idle" | "listening" | "sending" | { note: string };
const KIND_LABEL: Record<string, string> = {
  voucher: "Voucher", quotation: "Quotation", project: "Project", client: "Client",
  vendor: "Supplier", document: "Document", task: "Task", engagement: "Event",
};

type AnnaSpend = { month: string; modelsUSD: number; voiceUSD: number; limitUSD: number; speechChars?: number; speechLimit?: number };

function AnnaChat({ t, lang, userName, speechReady, arabicVoice, voiceBank, spend, prefill, open, voiceReady, listenSignal, onMood, onGuide, doorLabel, onOpenDoor, onOpenRecord, onEditDraft }: {
  t: (s: string) => string;
  userName: string;
  /** Layla/Ava are set up on the server (state.anna.speech); otherwise the phone's own voice. */
  speechReady: boolean;
  /** Arabic answers spoken too (off: Saad found the Lebanese voices poor). */
  arabicVoice: boolean;
  /** Saad's own recording space (plan §C) is offered in the ⋯ menu. */
  voiceBank: boolean;
  spend: AnnaSpend | null;
  /** "Ask about this policy": the chapter, shown as a chip above the box and sent with the question. */
  prefill: { text: string; nonce: number } | null;
  /** The panel is showing. The chat stays mounted while it is closed, so an answer on its way still lands. */
  open: boolean;
  /** Bumped by the floating button's mic: start listening once per bump. */
  listenSignal: number;
  onMood: (mood: AnnaMood, level: number) => void;
  /** Start a walkthrough: the panel steps aside so the screen can be seen. */
  onGuide: (g: Guide) => void;
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
  const [menu, setMenu] = useState(false);
  const [recording, setRecording] = useState(false);
  const [about, setAbout] = useState("");
  const recRef = useRef<Recording | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { openChatId = chatId; }, [chatId]);
  useEffect(() => { voiceLangPick = vLang; }, [vLang]);
  const [speaking, setSpeaking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [talk, setTalk] = useState(false);
  // Callbacks that fire later (a clip ends, a voice stops) call the newest render's functions
  // through these, so a follow-up turn never sends an old conversation.
  const talkRef = useRef(false);
  const micRef = useRef<() => void>(() => {});
  const sendRef = useRef<(s: string) => void>(() => {});
  const turnId = useRef(0);   // bumped whenever a pending "listen after speaking" must not fire
  useEffect(() => { talkRef.current = talk; }, [talk]);
  useEffect(() => { if (prefill) { setList(null); setAbout(prefill.text.replace(/(\s*[—–-]\s*)+$/, "")); } }, [prefill?.nonce]);
  const misses = useRef(0);   // not understood twice in a row ends a talk
  const endedByHand = useRef(false);   // he ended the talk: an answer still on its way is shown, not spoken
  const stopTalk = () => { setTalk(false); talkRef.current = false; turnId.current++; };
  /** Speak, then (in talk mode) listen again. Without device voices she just listens. */
  const sayThenListen = (text: string, listen: boolean) => {
    const id = ++turnId.current;
    const next = () => { if (listen && id === turnId.current && talkRef.current) micRef.current(); };
    if (typeof speechSynthesis === "undefined") return next();
    // An Arabic answer is shown, not spoken (no good Arabic voice yet); she says so once and keeps listening.
    if (!speak(text, on => { setSpeaking(on); if (!on) next(); }, speechReady, arabicVoice)) {
      if (/[\u0600-\u06FF]/.test(text)) setVoice({ note: t("Arabic answers are shown as text — no Arabic voice yet.") });
      next();
    }
  };
  const greet = (listen: boolean) => {
    const line = greeting(lang, userName);
    setMsgs(prev => (prev.length ? prev : [{ role: "assistant", content: line, local: true }]));
    if (listen) sayThenListen(line, true);
  };
  // A bump from the floating mic is acted on once, even if this chat is later remounted.
  useEffect(() => {
    if (!listenSignal || listenSignal === listenHandled) return;
    listenHandled = listenSignal;
    setTalk(true); talkRef.current = true; endedByHand.current = false;
    if (!msgs.length) greet(true); else void mic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenSignal]);
  // Closing the panel ends a recording (nothing is sent), any speech and the talk; opening greets.
  useEffect(() => {
    if (!open) { stopTalk(); recRef.current?.cancel(); hush(); return; }
    focusBox(inputRef.current);
    if (!msgs.length && listenSignal === listenHandled && !talkRef.current) greet(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => { recRef.current?.cancel(); hush(); }, []);
  const mood: AnnaMood = voice === "listening" ? "listening" : busy || voice === "sending" ? "thinking" : opening ? "opening" : speaking ? "speaking" : "idle";
  useEffect(() => { onMood(mood, level); }, [mood, level, onMood]);

  /** One control for voice. Tap: start talking (answers are spoken, she listens again). While
   *  listening, tap sends. While she is thinking or speaking in a talk, tap ends the talk. */
  const mic = async (byHand = false) => {
    if (voice === "listening") { recRef.current?.stop(); return; }
    if (byHand && talkRef.current) { endedByHand.current = true; stopTalk(); hush(); setVoice({ note: t("Talk ended.") }); return; }
    if (busy || voice === "sending") return;
    if (byHand) { unlockVoice(); setTalk(true); talkRef.current = true; misses.current = 0; endedByHand.current = false; }
    turnId.current++;
    if (!voiceReady) { setVoice({ note: t("Voice is not set up yet.") }); return; }
    if (!voiceSupported()) { setVoice({ note: t("Voice needs the secure address of the app (https) on a recent browser.") }); return; }
    hush();
    try {
      recRef.current = await record(setLevel, async clip => {
        recRef.current = null;
        if (!clip) { stopTalk(); setVoice({ note: t("I didn't hear anything.") }); return; }
        setVoice("sending");
        try {
          const r = await fetch("/api/anna/listen", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lang: vLang, audio: { mimeType: clip.type, base64: await clipBase64(clip) } }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || t("I couldn't hear that. Try again."));
          const words = String(d.transcript || "").trim();
          if (d.lang === "ar" || d.lang === "en") setVLang(d.lang);   // the next clip starts in the language just heard
          if (!words) {
            // Not understood: said here, for free — nothing goes to Anna. Twice in a row ends a talk.
            const miss = t("Didn't catch that — try again.");
            setVoice({ note: miss });
            if (talkRef.current && ++misses.current < 2) sayThenListen(miss, true); else stopTalk();
            return;
          }
          misses.current = 0;
          setVoice("idle");
          sendRef.current(words);
          if (BYE.test(words)) stopTalk();   // she answers the goodbye, then stops listening
        } catch (e: any) { stopTalk(); setVoice({ note: e.message }); }
      });
      setVoice("listening");
    } catch {
      setVoice({ note: t("The microphone is not allowed. Allow it for this app, then try again.") });
    }
  };
  useEffect(() => { if (chatId) openChat(chatId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
  const newChat = () => { stopTalk(); hush(); setMsgs([]); setCards({}); setQ(""); setChatId(""); setList(null); focusBox(inputRef.current); };
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
      // A quotation is always a Draft; a client card only ever creates — an id would overwrite someone.
      const body = p.kind === "quotation" ? { ...p.data, status: "Draft" } : p.kind === "client" ? { ...p.data, id: undefined } : p.data;
      const r = await fetch(p.confirmRoute, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Drafted-By": "anna" }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || t("Could not save."));
      setCards(c => ({ ...c, [key]: "saved" }));
      // Registering a client was a step towards a quotation: Anna carries on, on his press.
      if (p.kind === "client") void sendRef.current(`${t("Registered as a client")}: ${String(p.data.name || "")}. ${t("Carry on with the quotation.")}`);
    } catch (e: any) {
      setCards(c => ({ ...c, [key]: { error: e.message } }));
    }
  };

  const send = async (spoken?: string) => {
    const typed = (spoken ?? q).trim();
    if (!typed || busy) return;
    const text = about ? `${about}: ${typed}` : typed;
    const inTalk = talkRef.current;   // read before a goodbye ends the talk: the goodbye is still answered aloud
    const history = [...msgs.filter(m => !m.error && !m.local), { role: "user" as const, content: text }];
    if (spoken === undefined) setQ("");
    setAbout("");
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
      if (d.answer && inTalk && !endedByHand.current) sayThenListen(String(d.answer), talkRef.current);
      setMsgs(prev => [...prev, { role: "assistant", content: String(d.answer || ""), actions, usd: d.usage?.usd }]);
      const navs = actions.filter(a => a.type === "open_door" || a.type === "open_record") as NavAction[];
      navs.forEach(run);
      if (navs.length) { setOpening(true); setTimeout(() => setOpening(false), 1200); }
    } catch (e: any) {
      stopTalk();
      // A failed turn is shown but never sent back as history; the question stays so it can be retried.
      setMsgs(prev => [...prev.slice(0, -1), { ...prev[prev.length - 1], error: true }, { role: "assistant", content: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  micRef.current = () => void mic();
  sendRef.current = s => void send(s);

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
            {(m.actions || []).map((a, k) => a.type === "guide" ? (
              <button key={k} onClick={() => onGuide({ door: a.door, steps: a.steps })}
                className="me-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#6D1A1A] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#4A1010]">
                {t("Show me")} · {doorLabel(a.door)} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </button>
            ) : a.type === "choice" ? (
              // A close spelling is never picked for Saad: he taps the one he meant, which is sent as his reply.
              <div key={k} className="flex flex-wrap gap-1.5">
                {a.options.map(name => (
                  <button key={name} onClick={() => send(`${t("I meant")}: ${name.slice(0, 80)}`)} disabled={busy || !!m.past || i !== msgs.length - 1}
                    className="min-h-[36px] rounded-lg border border-[#6D1A1A] px-3 text-[11px] font-bold text-[#6D1A1A] transition-colors hover:bg-[#6D1A1A]/5 disabled:opacity-40">
                    {name}
                  </button>
                ))}
              </div>
            ) : a.type === "proposal" ? (() => {
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
                      {p.kind !== "request" && p.kind !== "client" && (
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

      {(() => {
        const note = voice === "listening" ? t("Listening… tap to send") : voice === "sending" ? t("Writing it down…")
          : typeof voice === "object" ? voice.note : talk && (busy || speaking) ? t("Tap the mic to end the talk") : "";
        return note ? <p role="status" className="border-t border-slate-200 px-3 pt-1.5 text-center text-[11px] leading-snug text-slate-600">{note}</p> : <p role="status" className="sr-only" />;
      })()}
      {about && (
        <div className="flex px-2 pt-1.5">
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#F88888]/15 ps-2.5 text-[11px] font-bold text-[#6D1A1A]">
            <span className="truncate">{t("About")}: {about}</span>
            <button onClick={() => setAbout("")} aria-label={t("Remove")} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#6D1A1A]/10">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}
      {recording && <AnnaRecorder onClose={() => setRecording(false)} />}
      <div className="relative flex items-end gap-2 border-t border-slate-200 p-2">
        <button onClick={() => setMenu(m => !m)} aria-label={t("More")} aria-expanded={menu} title={t("More")}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100">
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menu && (<>
          <button aria-hidden tabIndex={-1} onClick={() => setMenu(false)} className="fixed inset-0 cursor-default" />
          <div role="menu" data-anna-menu className="absolute bottom-full start-2 mb-1 w-64 space-y-1 rounded-xl border border-[#E6D3CA] bg-white p-1.5 text-[12px] shadow-xl">
            <button role="menuitem" onClick={() => { setMenu(false); void showList(); }} disabled={busy}
              className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-start text-slate-800 hover:bg-slate-100 disabled:opacity-40">
              <History className="h-4 w-4 text-slate-500" /> {t("Past chats")}
            </button>
            <button role="menuitem" onClick={() => { setMenu(false); newChat(); }} disabled={busy || !msgs.some(m => !m.local)}
              className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-start text-slate-800 hover:bg-slate-100 disabled:opacity-40">
              <RotateCcw className="h-4 w-4 text-slate-500" /> {t("New conversation")}
            </button>
            {voiceBank && (
              <button role="menuitem" onClick={() => { setMenu(false); stopTalk(); hush(); setRecording(true); }}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-start text-slate-800 hover:bg-slate-100">
                <Mic className="h-4 w-4 text-slate-500" /> {t("Record my voice for Anna")}
              </button>
            )}
            <div className="flex min-h-[40px] items-center justify-between gap-2 px-2">
              <span className="text-slate-600">{t("Voice language")}</span>
              <div role="radiogroup" aria-label={t("Voice language")} className="flex overflow-hidden rounded-md border border-slate-300">
                {(["en", "ar"] as const).map(l => (
                  <button key={l} role="radio" aria-checked={vLang === l} onClick={() => setVLang(l)} disabled={voice === "listening"}
                    className={`min-h-[30px] px-2.5 font-bold ${vLang === l ? "bg-[#6D1A1A] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    {l === "en" ? "EN" : "عربي"}
                  </button>
                ))}
              </div>
            </div>
            {spend && (
              <p dir="ltr" data-anna-spend className={`border-t border-slate-100 px-2 pt-1.5 text-[11px] ${spend.modelsUSD >= 0.8 * spend.limitUSD || (spend.speechChars || 0) >= 0.8 * (spend.speechLimit || Infinity) ? "font-bold text-amber-700" : "text-slate-500"}`}>
                {spend.month} so far: ${spend.modelsUSD.toFixed(2)} of ${spend.limitUSD} · listening ${spend.voiceUSD.toFixed(2)}
                {typeof spend.speechChars === "number" && spend.speechLimit ? <> · voice {Math.round(spend.speechChars / 1000)}k of {Math.round(spend.speechLimit / 1000)}k free chars</> : null}
              </p>
            )}
          </div>
        </>)}
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
          onClick={() => mic(true)}
          disabled={!talk && (busy || voice === "sending")}
          aria-label={voice === "listening" ? t("Stop and send") : talk ? t("End the talk") : t("Speak to Anna")}
          aria-pressed={talk}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-white shadow-md transition-colors disabled:opacity-40 ${voice === "listening" ? "bg-[#4A1010]" : "bg-[#6D1A1A] hover:bg-[#4A1010]"} ${voiceReady ? "" : "opacity-60"}`}
        >
          {voice === "listening" ? (
            <span aria-hidden className="flex h-5 items-center gap-[3px]">
              {[0.6, 1, 0.8].map((k, i) => (
                <span key={i} className="w-[3px] rounded-full bg-white" style={{ height: `${Math.max(3, Math.round(20 * Math.min(1, level * k * 1.6)))}px` }} />
              ))}
              <Square className="ms-1 h-2.5 w-2.5 fill-current" />
            </span>
          ) : talk ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          onClick={() => send()}
          disabled={busy || !q.trim()}
          aria-label={t("Send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#6D1A1A] text-[#6D1A1A] transition-colors hover:bg-[#6D1A1A]/5 disabled:border-slate-300 disabled:text-slate-400"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export default function HelpDesk({
  t, lang, rtl, doorLabel, onOpenDoor, openSignal, anna = false, annaVoice = false, annaSpeech = false, annaArabicVoice = false, annaVoiceBank = false, userName = "", annaSpend = null, onOpenRecord = () => {}, onEditDraft = () => {},
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
  /** For Anna's greeting. */
  userName?: string;
  /** Whether the server has Anna's natural voice (state.anna.speech). */
  annaSpeech?: boolean;
  /** Whether Arabic answers are spoken (state.anna.arabicVoice). Off by default. */
  annaArabicVoice?: boolean;
  /** Offer "Record my voice for Anna" (Saad, as himself). */
  annaVoiceBank?: boolean;
  /** This month's AI spend — the server sends it to the master account only. */
  annaSpend?: AnnaSpend | null;
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
  const [listenSignal, setListenSignal] = useState(0);
  const [guide, setGuide] = useState<Guide | null>(null);
  const startGuide = useCallback((g: Guide) => { setGuide(g); setOpen(false); }, []);
  const endGuide = useCallback(() => setGuide(null), []);
  const [mood, setMood] = useState<{ mood: AnnaMood; level: number }>({ mood: "idle", level: 0 });
  const onMood = useCallback((m: AnnaMood, level: number) => setMood({ mood: m, level }), []);
  const [orbAt, setOrbAt] = useState<OrbAt | null>(() => (anna ? readOrb() : null));
  const [, setResized] = useState(0);
  const orbRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // Each time the launcher appears, place a remembered Anna against the real column (the ref
  // is empty on the render that creates it), not the window.
  useEffect(() => { if (!open) setResized(n => n + 1); }, [open]);

  /** Never left on the orange "missing" pill: it sits above her and would take the tap. */
  const clearOfPill = (at: OrbAt): OrbAt => {
    const col = (orbRef.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    const me = orbRef.current?.getBoundingClientRect();
    const pill = document.querySelector('[data-float="gaps"]')?.getBoundingClientRect();
    if (!col || !me || !pill) return at;
    // How far apart the two boxes are on the nearer axis; within 8px counts as touching.
    const apart = Math.max(pill.left - me.right, me.left - pill.right, pill.top - me.bottom, me.top - pill.bottom);
    if (8 < apart) return at;
    const top = pill.top - 8 - ORB - col.top;
    return { ...at, fy: Math.min(1, Math.max(0, (top - ORB_MARGIN) / Math.max(1, col.height - ORB - 2 * ORB_MARGIN))) };
  };
  // A remembered spot can land on the pill after a rotation or when the pill first appears.
  useEffect(() => {
    if (open || !anna || !orbAt || drag.current) return;
    const at = clearOfPill(orbAt);
    if (at.fy !== orbAt.fy) setOrbAt(at);
  });
  useEffect(() => {
    const again = () => setResized(n => n + 1);
    window.addEventListener("resize", again);
    return () => window.removeEventListener("resize", again);
  }, []);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && mode === "help") inputRef.current?.focus(); }, [open, mode]);
  // Anna is the help desk for everyone who has her (plan §10): no second tab.
  useEffect(() => { setMode(anna ? "anna" : "help"); }, [anna]);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!openSignal) return;
    setOpen(true);
    if (anna) { setMode("anna"); setPrefill({ text: `${openSignal.context} — `, nonce: openSignal.nonce }); return; }
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
  const openPanel = (listen: boolean) => { if (listen) unlockVoice(); setGuide(null); setMode("anna"); if (listen) setListenSignal(n => n + 1); setOpen(true); };

  let launcher: ReactNode = null;
  if (!open) {
    // The column the bubble is placed in; a dragged Anna is kept inside it.
    const box = orbRef.current?.offsetParent as HTMLElement | null;
    const w = box?.clientWidth || window.innerWidth, h = box?.clientHeight || window.innerHeight;
    const place = (fx: number, fy: number) => ({
      insetInlineStart: "auto", insetBlockEnd: "auto",
      left: Math.round(ORB_MARGIN + fx * Math.max(0, w - ORB - 2 * ORB_MARGIN)),
      top: Math.round(ORB_MARGIN + fy * Math.max(0, h - ORB - 2 * ORB_MARGIN)),
    });
    const moveTo = (e: PointerEvent) => {
      // Read at event time: on the first render the ref was still empty.
      const r = (orbRef.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
      if (!r) return null;
      const span = (n: number) => Math.max(1, n - ORB - 2 * ORB_MARGIN);
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      return { fx: clamp((e.clientX - r.left - ORB / 2 - ORB_MARGIN) / span(r.width)), fy: clamp((e.clientY - r.top - ORB / 2 - ORB_MARGIN) / span(r.height)) };
    };
    launcher = (
      <div
        ref={orbRef}
        data-float="help"
        style={anna && orbAt ? place(orbAt.fx, orbAt.fy) : undefined}
        className="absolute bottom-5 start-5 md:start-8 z-[95] h-12 w-12 rounded-full"
      >
        <button
          onClick={() => { if (drag.current?.moved) return; anna ? openPanel(false) : setOpen(true); }}
          onPointerDown={anna ? e => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); } : undefined}
          onPointerMove={anna ? e => {
            const d = drag.current;
            if (!d) return;
            if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
            d.moved = true;
            const at = moveTo(e);
            if (at) setOrbAt(at);
          } : undefined}
          onPointerUp={anna ? () => {
            if (drag.current?.moved && orbAt) {
              const at = clearOfPill(orbAt);
              if (at !== orbAt) setOrbAt(at);
              try { localStorage.setItem(ORB_KEY, JSON.stringify(at)); } catch { /* private mode: she stays put until reload */ }
            }
            // The click that follows a drag is swallowed, then the flag clears.
            setTimeout(() => { drag.current = null; }, 0);
          } : undefined}
          onPointerCancel={anna ? () => { drag.current = null; } : undefined}
          title={anna ? t("Anna — tap to talk, drag to move") : t("Ask for help")}
          aria-label={anna ? t("Open Anna") : t("Ask for help")}
          style={anna ? { touchAction: "none" } : undefined}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6D1A1A] text-white shadow-lg shadow-[#6D1A1A]/25 transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[#4A1010] hover:shadow-xl hover:shadow-[#6D1A1A]/30"
        >
          {anna ? <AnnaWave mood={mood.mood} level={mood.level} t={t} /> : <MessageCircleQuestion className="h-5 w-5" />}
        </button>
        {anna && (
          <button
            onClick={() => openPanel(true)}
            aria-label={t("Speak to Anna")} title={t("Speak to Anna")}
            className="absolute -top-3 -end-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#E6D3CA] bg-white text-[#6D1A1A] shadow-md transition-colors hover:bg-[#F88888]/15"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Open: the panel is 335px wide on a phone and the "N missing" pill sits in the
  // opposite bottom corner — measured, the panel covered it whole (106x36) and the pill
  // could not be clicked. The overlap exists on any viewport under 498px, so the panel
  // lifts clear until `lg` and drops back to the launcher's corner above it. Height is
  // not fixed (Arabic wraps differently), so this raises the bottom, never the top.
  // `lg` and not `sm`: from `md` the panel starts at the content edge (288px), which at
  // 768-771px puts its right edge back under the pill. Measured, not guessed.
  return (<>
    {launcher}
    {guide && <AnnaGuide guide={guide} t={t} rtl={rtl} onOpenDoor={onOpenDoor} onDone={endGuide} />}
    <div
      ref={boxRef}
      hidden={!open}
      dir={rtl ? "rtl" : "ltr"}
      className="absolute bottom-24 start-5 md:start-8 z-[95] flex max-h-[70vh] w-[min(22rem,100%-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[#E6D3CA] bg-white shadow-2xl shadow-[#4A1010]/20 lg:bottom-5"
    >
      <div className="flex items-center justify-between gap-2 bg-[#6D1A1A] ps-3 pe-1.5 py-1.5 text-white">
        {anna ? (
          <div className="flex items-center gap-2">
            <AnnaWave mood={mood.mood} level={mood.level} t={t} />
            <p className="text-xs font-bold">{"Anna"}</p>
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

      {anna && (
        <div hidden={mode !== "anna"} className="flex min-h-0 flex-1 flex-col">
          <AnnaChat t={t} lang={lang} userName={userName} speechReady={annaSpeech} arabicVoice={annaArabicVoice} voiceBank={annaVoiceBank} spend={annaSpend} prefill={prefill} open={open && mode === "anna"} voiceReady={annaVoice} listenSignal={listenSignal} onMood={onMood} onGuide={startGuide}
            doorLabel={doorLabel} onOpenDoor={onOpenDoor} onOpenRecord={onOpenRecord} onEditDraft={onEditDraft} />
        </div>
      )}
      {(mode === "help" || !anna) && (<>
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
  </>);
}
