/** Repeating "up for grabs" alarm for clocked-in field staff. */

export const OPEN_JOB_ALARM_MS = 5 * 60_000;

/** Jobs that still have free places and have not been dismissed in this session. */
export function alarmJobs<T extends { id: string; places_left: number }>(jobs: T[], dismissed: ReadonlySet<string>): T[] {
  return jobs.filter((j) => j.places_left > 0 && !dismissed.has(j.id));
}

/** Short two-tone chime; silently no-ops where audio is unavailable or blocked. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    };
    play(880, 0);
    play(1174.66, 0.18);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 1200);
  } catch {
    /* audio blocked until a user gesture — the banner still shows */
  }
}
