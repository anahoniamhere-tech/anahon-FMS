/**
 * Anna's microphone and voice (HelpDesk.tsx). Batch, not streaming: record one clip, send it to
 * /api/anna/listen once. Never the browser's Web Speech recognition — Chrome sends that audio to
 * Google, and it breaks in the iOS home-screen app (drafts/voice-front-desk-plan.md).
 */

/** The mic needs a secure page (https or localhost) and MediaRecorder (iOS 14.3+). */
export const voiceSupported = () =>
  typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

// ponytail: an energy threshold, not Silero VAD — a loud room can hold a clip open until the
// 30 s cap or a tap. Swap in @ricky0123/vad-web if that happens in real use.
const SPEECH_RMS = 0.02;
const QUIET_MS = 1200;       // this long quiet after speech ends the clip
const NOTHING_MS = 8000;     // no speech at all by then: nothing is sent (and talk mode ends)
const CAP_MS = 30_000;       // the server refuses anything much longer

export type Recording = { stop: () => void; cancel: () => void };

/** Records until quiet, a stop() or 30 s. `onLevel` gets 0..1 for the bars; `onDone` gets the
 *  clip, or null when nothing was said or it was cancelled. Throws if the mic is refused. */
export async function record(onLevel: (level: number) => void, onDone: (clip: Blob | null) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(t => MediaRecorder.isTypeSupported(t)) || "";
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  let cancelled = false;
  const ctx = new AudioContext();
  void ctx.resume();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const started = performance.now();
  let heard = false, quietSince = started;

  const stop = () => { if (rec.state !== "inactive") rec.stop(); };
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const rms = Math.sqrt(buf.reduce((n, x) => n + x * x, 0) / buf.length);
    onLevel(Math.min(1, rms * 8));
    const now = performance.now();
    if (rms > SPEECH_RMS) { heard = true; quietSince = now; }
    if (!heard && now - started > NOTHING_MS) { cancelled = true; stop(); }
    if ((heard && now - quietSince > QUIET_MS) || now - started > CAP_MS) stop();
  }, 50);

  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    clearInterval(timer);
    stream.getTracks().forEach(t => t.stop());   // the iPhone's mic light goes off here
    void ctx.close();
    onLevel(0);
    onDone(cancelled || !chunks.length ? null : new Blob(chunks, { type: rec.mimeType || type || "audio/webm" }));
  };
  rec.start(250);
  return { stop, cancel: () => { cancelled = true; stop(); } };
}

export const clipBase64 = (clip: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(r.error);
  r.readAsDataURL(clip);
});

/* ── Anna's voice. Layla (Arabic) and Ava (English) come from /api/anna/say, one piece at a time,
   played in order as each arrives; the phone's own voice speaks whatever Azure cannot (a failure, or
   the month's free characters used up). iOS plays audio only from a tap, so one player is unlocked
   when the mic is tapped and reused for every piece. */
const SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";   // 50 ms of silence
let player: HTMLAudioElement | null = null;
let stopPiece: (() => void) | null = null;
let gen = 0;
let current: ((on: boolean) => void) | null = null;   // whoever is being told "speaking"
/** Call from the tap that starts a talk: it makes later, programmatic playback allowed on iOS. */
export function unlockVoice() {
  if (typeof Audio === "undefined") return;
  if (!player) player = new Audio();
  player.src = SILENT;
  void player.play().catch(() => {});
}

/** Plain speech: no markdown, no cost lines; cut into pieces the server accepts (≤ 400 characters). */
export function voicePieces(text: string): string[] {
  const plainText = text.replace(/\*\*|__|`|#+\s|≈ \$[\d.]+/g, "").replace(/\s+/g, " ").trim();
  const sentences = plainText.split(/(?<=[.!?؟])\s+|(?<=\n)/).map(x => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences.flatMap(x => x.length > 380 ? x.match(/[\s\S]{1,380}(\s|$)/g) || [x] : [x])) {
    const last = out[out.length - 1];
    // Short sentences travel together (fewer requests), except the first, which should start at once.
    if (last && out.length > 1 && last.length + s.length < 200) out[out.length - 1] = `${last} ${s}`; else out.push(s.trim());
  }
  return out;
}

function deviceSpeak(text: string, done: () => void) {
  if (typeof speechSynthesis === "undefined" || !text) return done();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
  u.onend = u.onerror = () => done();
  speechSynthesis.speak(u);
}

const fetchPiece = (text: string) =>
  fetch("/api/anna/say", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
    .then(r => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))));

/** Reads an answer aloud: Ava (and Layla, if switched on) first, the phone's voice for anything they
 *  cannot say. `useServer` false (or no unlocked player) means the phone's voice only. Arabic is
 *  never spoken while `arabic` is false — no voice at all rather than a bad one (Saad, 16 Sep).
 *  Returns false when nothing was left to say. */
export function speak(text: string, onSpeaking: (on: boolean) => void = () => {}, useServer = true, arabic = false): boolean {
  hush();
  const my = ++gen;
  const pieces = voicePieces(text).filter(p => arabic || !/[\u0600-\u06FF]/.test(p));
  if (!pieces.length) return false;
  current = onSpeaking;
  onSpeaking(true);
  const finish = () => { if (my === gen) { current = null; onSpeaking(false); } };
  if (!useServer || !player) { deviceSpeak(pieces.join(" "), finish); return true; }
  // All pieces are fetched at once, and played in order as they are ready.
  const audio = pieces.map(p => fetchPiece(p).catch(() => null));
  void (async () => {
    for (let i = 0; i < pieces.length; i++) {
      if (my !== gen) return;
      const blob = await audio[i];
      if (my !== gen) return;
      if (!blob) { deviceSpeak(pieces.slice(i).join(" "), finish); return; }
      const url = URL.createObjectURL(blob);
      const ok = await new Promise<boolean>(resolve => {
        const p = player!;
        stopPiece = () => resolve(false);
        p.onended = () => resolve(true);
        p.onerror = () => resolve(false);
        p.src = url;
        p.play().catch(() => resolve(false));
      });
      URL.revokeObjectURL(url);
      stopPiece = null;
      if (my !== gen) return;
      if (!ok) { deviceSpeak(pieces.slice(i).join(" "), finish); return; }
    }
    finish();
  })();
  return true;
}

export const hush = () => {
  gen++;
  // Whoever was told "speaking" hears that it stopped (the waveform must not stay on).
  const told = current; current = null; told?.(false);
  if (player) { player.onended = null; player.pause(); }
  stopPiece?.(); stopPiece = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
};
