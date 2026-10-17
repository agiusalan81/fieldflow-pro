/** Allowed inactivity auto-logout choices in minutes (0 = off). Max is 3 hours. */
export const IDLE_CHOICES = [0, 15, 30, 60, 120, 180] as const;
export const MAX_IDLE_MINUTES = 180;

export function clampIdle(min: number | null | undefined): number {
  const n = Number(min ?? 30);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_IDLE_MINUTES);
}

/** Should an idle user be signed out? Technicians with a running clock-in are never signed out. */
export function shouldAutoLogout(opts: { idleMs: number; timeoutMin: number; isTechnician: boolean; clockedIn: boolean }): boolean {
  const t = clampIdle(opts.timeoutMin);
  if (t === 0) return false;
  if (opts.isTechnician && opts.clockedIn) return false;
  return opts.idleMs >= t * 60_000;
}
