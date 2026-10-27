/** Chat timeline labels. All functions take an explicit "now" so they are testable. */
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function chatDayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** True when a date divider is needed before this message. */
export function needsDayDivider(prev: string | undefined, cur: string): boolean {
  return !prev || dayKey(new Date(prev)) !== dayKey(new Date(cur));
}

/** Same-day gap of 3 hours or more gets a small time marker. */
export function needsGapMarker(prev: string | undefined, cur: string): boolean {
  return !!prev && !needsDayDivider(prev, cur) && new Date(cur).getTime() - new Date(prev).getTime() >= 3 * 3600_000;
}

export const chatClock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const chatFullStamp = (iso: string) => new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Sidebar stamp: time today, "Yesterday", otherwise a short date. */
export function chatListStamp(iso: string, now = new Date()): string {
  const label = chatDayLabel(iso, now);
  if (label === "Today") return chatClock(iso);
  if (label === "Yesterday") return label;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}

/** Terminated members are hidden from chat contacts. */
export const chatContactVisible = (status: string | null | undefined) => status !== "terminated";
