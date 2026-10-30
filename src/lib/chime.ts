/** Notification sounds via Web Audio (no files). Per-user mute stored on this device. */
export type ChimeKind = "message" | "approval" | "urgent";
const key = (uid: string) => `fieldflow:sounds:${uid}`;
export const soundsOn = (uid: string) => { try { return localStorage.getItem(key(uid)) !== "off"; } catch { return true; } };
export const setSoundsOn = (uid: string, on: boolean) => { try { localStorage.setItem(key(uid), on ? "on" : "off"); } catch { /* ignore */ } };
let ctx: AudioContext | null = null;
const NOTES: Record<ChimeKind, number[]> = { message: [660, 880], approval: [523, 659, 784], urgent: [988, 0, 988, 0, 988] };
function audioContext() {
  if (ctx && ctx.state !== 'closed') return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}
/** Called synchronously from a trusted tap/key press, before realtime alerts arrive. */
export function unlockChimes(): void {
  try {
    const audio = audioContext();
    if (!audio) return;
    // A zero-volume buffer started in the gesture also unlocks older iOS Web Audio.
    if (typeof audio.createBufferSource === 'function') {
      const source = audio.createBufferSource();
      source.buffer = audio.createBuffer(1, 1, 22050);
      source.connect(audio.destination); source.start(0);
    }
    if (audio.state !== 'running') void audio.resume().catch(() => undefined);
  } catch { /* unavailable */ }
}
export function listenForChimeUnlock(): () => void {
  const unlock = () => unlockChimes();
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true, passive: true });
  return () => { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); document.removeEventListener('touchend', unlock, true); };
}
export async function playChime(kind: ChimeKind, uid?: string): Promise<boolean> {
  if (uid && !soundsOn(uid)) return false;
  try {
    const audio = audioContext();
    if (!audio) return false;
    // Never wait indefinitely on a resume outside a user gesture.
    if (audio.state !== 'running') return false;
    const t0 = audio.currentTime;
    NOTES[kind].forEach((f, i) => {
      if (!f) return;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = t0 + i * 0.14;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.4);
    });
    return true;
  } catch { return false; }
}
