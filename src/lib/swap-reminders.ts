export function swapReminderDue(until: string | null | undefined, now = Date.now()) {
  return !until || Date.parse(until) <= now;
}