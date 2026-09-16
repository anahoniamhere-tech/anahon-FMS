import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mic, Square, Play, RotateCcw, Check, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { VOICE_RATE, VOICE_MAX_S, takeQuality } from "./annaVoiceBank";

/* Saad's own voice, one sentence at a time (drafts/anna-learns-arabic-plan.md §C). Raw audio, no
   echo cancellation or noise suppression (they change a voice), resampled to 22.05 kHz mono and
   saved as a WAV on the NAS through /api/anna/voicebank. Nothing is kept in the browser. */

type Bank = {
  consent: { acceptedAt: string } | null; consentText: string; minutes: number;
  sessions: { id: number; title: string; lines: string[]; done: number[] }[];
};

const call = async (path: string, body?: unknown) => {
  const r = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d;
};

function toWav(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2), v = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, VOICE_RATE, true);
  v.setUint32(28, VOICE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return out;
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

export default function AnnaRecorder({ onClose }: { onClose: () => void }) {
  const [bank, setBank] = useState<Bank | null>(null);
  const [err, setErr] = useState("");
  const [sid, setSid] = useState(1);
  const [line, setLine] = useState(0);
  const [rec, setRec] = useState<"idle" | "recording" | "review" | "saving">("idle");
  const [take, setTake] = useState<{ wav: Uint8Array; url: string; q: ReturnType<typeof takeQuality> } | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => { call("/api/anna/voicebank").then(setBank).catch(e => setErr(e.message)); }, []);
  useEffect(() => () => { stopRef.current?.(); }, []);
  const sess = bank?.sessions.find(s => s.id === sid);
  useEffect(() => {   // open each session at its first line not yet recorded
    if (!sess) return;
    const next = sess.lines.findIndex((_, i) => !sess.done.includes(i));
    setLine(next < 0 ? 0 : next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, !!bank]);
  const clearTake = () => { if (take) URL.revokeObjectURL(take.url); setTake(null); setRec("idle"); };

  const start = async () => {
    setErr(""); clearTake();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
      const ctx = new AudioContext();
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([`
        registerProcessor("grab", class extends AudioWorkletProcessor {
          process(inputs) { const c = inputs[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; }
        });`], { type: "text/javascript" })));
      const src = ctx.createMediaStreamSource(stream), node = new AudioWorkletNode(ctx, "grab");
      const chunks: Float32Array[] = [];
      node.port.onmessage = e => chunks.push(e.data);
      src.connect(node);
      const cap = setTimeout(() => stopRef.current?.(), VOICE_MAX_S * 1000 - 500);
      setRec("recording");
      stopRef.current = async () => {
        stopRef.current = null; clearTimeout(cap);
        src.disconnect(); node.port.onmessage = null;
        stream.getTracks().forEach(t => t.stop());
        const rate = ctx.sampleRate; await ctx.close();
        const raw = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
        let o = 0; for (const c of chunks) { raw.set(c, o); o += c.length; }
        // Resample to 22.05 kHz with the browser's own resampler.
        const len = Math.max(1, Math.round(raw.length * VOICE_RATE / rate));
        const off = new OfflineAudioContext(1, len, VOICE_RATE);
        const buf = off.createBuffer(1, raw.length, rate); buf.copyToChannel(raw, 0);
        const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start();
        const samples = (await off.startRendering()).getChannelData(0);
        const wav = toWav(samples);
        setTake({ wav, url: URL.createObjectURL(new Blob([wav], { type: "audio/wav" })), q: takeQuality(samples) });
        setRec("review");
      };
    } catch { setErr("The microphone is not allowed. Allow it for this app, then try again."); setRec("idle"); }
  };

  const save = async () => {
    if (!take || !sess) return;
    setRec("saving");
    try {
      await call("/api/anna/voicebank/take", { session: sid, line, wav: b64(take.wav) });
      const fresh = await call("/api/anna/voicebank");
      setBank(fresh); clearTake();
      setLine(l => Math.min(l + 1, sess.lines.length - 1));
    } catch (e: any) { setErr(e.message); setRec("review"); }
  };

  const remove = async (all: boolean) => {
    if (!window.confirm(all ? "Delete ALL of your voice recordings and the consent note? This cannot be undone." : "Delete this recording?")) return;
    try { setBank(await call("/api/anna/voicebank/delete", all ? { all: true } : { session: sid, line })); } catch (e: any) { setErr(e.message); }
  };

  const done = !!sess?.done.includes(line);
  // On the page itself, not inside Anna's panel: the panel's layer would put the "missing" pill on top.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Record my voice" data-anna-voicebank className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center justify-between gap-2 bg-[#6D1A1A] px-3 py-2 text-white">
        <p className="text-sm font-bold">Record my voice for Anna</p>
        <button onClick={() => { stopRef.current?.(); onClose(); }} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/15"><X className="h-5 w-5" /></button>
      </div>
      {!bank ? <p className="p-4 text-sm text-slate-600">{err || "Loading…"}</p> : !bank.consent ? (
        <div className="mx-auto max-w-md space-y-4 p-5">
          <p className="text-[15px] leading-relaxed text-slate-800">{bank.consentText}</p>
          <button onClick={() => call("/api/anna/voicebank/consent", { text: bank.consentText }).then(setBank).catch(e => setErr(e.message))}
            className="min-h-[48px] w-full rounded-xl bg-[#6D1A1A] text-sm font-bold text-white">I agree</button>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      ) : sess && (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
            {bank.sessions.map(s => (
              <button key={s.id} onClick={() => { clearTake(); setSid(s.id); }}
                className={`min-h-[36px] rounded-lg px-3 font-bold ${s.id === sid ? "bg-[#6D1A1A] text-white" : "border border-slate-300"}`}>
                {s.id}. {s.title} · {s.done.length}/{s.lines.length}
              </button>
            ))}
            <span className="ms-auto">{bank.minutes.toFixed(1)} min recorded</span>
          </div>
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <button onClick={() => { clearTake(); setLine(l => Math.max(0, l - 1)); }} disabled={line === 0 || rec === "recording"} aria-label="Previous line"
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
            <span>Line {line + 1} of {sess.lines.length}{done ? " · recorded ✓" : ""}</span>
            <button onClick={() => { clearTake(); setLine(l => Math.min(sess.lines.length - 1, l + 1)); }} disabled={line === sess.lines.length - 1 || rec === "recording"} aria-label="Next line"
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <p dir="rtl" className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-[26px] leading-[1.7] text-slate-900">{sess.lines[line]}</p>
          <p className="text-center text-[12px] text-slate-500">
            {rec === "recording" ? "Recording… read the sentence naturally, then tap stop." : "Tap the mic, wait a breath, read the sentence, tap stop. A quiet room is best."}
          </p>
          <div className="flex items-center justify-center gap-3">
            {rec === "recording" ? (
              <button onClick={() => stopRef.current?.()} aria-label="Stop" className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4A1010] text-white shadow-lg"><Square className="h-6 w-6 fill-current" /></button>
            ) : (
              <button onClick={start} disabled={rec === "saving"} aria-label={take ? "Record again" : "Record"}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[#6D1A1A] text-white shadow-lg disabled:opacity-40">
                {take ? <RotateCcw className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
              </button>
            )}
            {take && rec !== "recording" && (<>
              <button onClick={() => void new Audio(take.url).play()} aria-label="Listen" className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300"><Play className="h-5 w-5" /></button>
              <button onClick={save} disabled={!take.q.ok || rec === "saving"} aria-label="Save and next"
                className="flex h-12 min-w-[7rem] items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-40">
                <Check className="h-5 w-5" /> {rec === "saving" ? "Saving…" : "Save"}
              </button>
            </>)}
          </div>
          {take && (
            <div role="status" className="space-y-1 text-center text-[12px]">
              {take.q.block.map(m => <p key={m} className="font-bold text-red-700">{m}</p>)}
              {take.q.warn.map(m => <p key={m} className="text-amber-700">{m}</p>)}
              {take.q.ok && !take.q.warn.length && <p className="text-emerald-700">Sounds good.</p>}
            </div>
          )}
          {err && <p className="text-center text-sm text-red-700">{err}</p>}
          <div className="mt-auto flex justify-between border-t border-slate-100 pt-3 text-[12px]">
            <button onClick={() => remove(false)} disabled={!done} className="inline-flex min-h-[40px] items-center gap-1 text-slate-500 disabled:opacity-30"><Trash2 className="h-4 w-4" /> Delete this line's recording</button>
            <button onClick={() => remove(true)} className="min-h-[40px] font-bold text-red-700">Delete all recordings</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
