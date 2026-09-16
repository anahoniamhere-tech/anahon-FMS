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
const NOTHING_MS = 6000;     // no speech at all by then: nothing is sent
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

/** Reads an answer aloud with the device's own voices; nothing leaves the device. */
export function speak(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ""));
  u.lang = /[؀-ۿ]/.test(text) ? "ar" : "en";
  speechSynthesis.speak(u);
}
export const hush = () => { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); };
