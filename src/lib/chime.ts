/** Notification sounds via Web Audio (no files). Per-user mute stored on this device. */
export type ChimeKind = "message" | "approval" | "urgent";
const key = (uid: string) => `fieldflow:sounds:${uid}`;
export const soundsOn = (uid: string) => { try { return localStorage.getItem(key(uid)) !== "off"; } catch { return true; } };
export const setSoundsOn = (uid: string, on: boolean) => { try { localStorage.setItem(key(uid), on ? "on" : "off"); } catch { /* ignore */ } };
let ctx: AudioContext | null = null;
const NOTES: Record<ChimeKind, number[]> = { message: [660, 880], approval: [523, 659, 784], urgent: [988, 0, 988, 0, 988] };
export function playChime(kind: ChimeKind, uid?: string) {
  if (uid && !soundsOn(uid)) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    NOTES[kind].forEach((f, i) => {
      if (!f) return;
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = t0 + i * 0.14;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch { /* audio unavailable */ }
}
