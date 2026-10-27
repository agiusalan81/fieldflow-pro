/** Lightweight inline formatting for checklist lines: **bold**, *italic*, __underline__ and [red]colour[/red]. */

export const RICH_COLORS = [
  { key: "red", label: "Critical (red)", token: "text-destructive" },
  { key: "amber", label: "Caution (amber)", token: "text-warning" },
  { key: "blue", label: "Note (blue)", token: "text-primary" },
  { key: "green", label: "Verified (green)", token: "text-success" },
] as const;
export type RichColor = (typeof RICH_COLORS)[number]["key"];

export type RichSpan = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: RichColor };

const COLOR_KEYS = RICH_COLORS.map(c => c.key).join("|");
const TOKEN = new RegExp(`(\\*\\*|__|\\*|\\[(?:${COLOR_KEYS})\\]|\\[\\/(?:${COLOR_KEYS})\\])`);

/** Parses marked-up text into styled spans; unmatched markers simply toggle off at line end. */
export function parseRich(text: string): RichSpan[] {
  const spans: RichSpan[] = [];
  const state: Omit<RichSpan, "text"> = {};
  for (const part of text.split(TOKEN)) {
    if (!part) continue;
    if (part === "**") state.bold = !state.bold;
    else if (part === "__") state.underline = !state.underline;
    else if (part === "*") state.italic = !state.italic;
    else if (/^\[\/\w+\]$/.test(part)) delete state.color;
    else if (/^\[\w+\]$/.test(part) && TOKEN.test(part)) state.color = part.slice(1, -1) as RichColor;
    else spans.push({ text: part, ...Object.fromEntries(Object.entries(state).filter(([, v]) => v)) });
  }
  return spans;
}

/** Plain text without formatting markers, for PDFs, search and job-sheet labels. */
export function stripRich(text: string): string {
  return parseRich(text).map(s => s.text).join("");
}

const MARKER = /(\*\*|__|\*|\[\/?\w+\])/g;

/**
 * Wraps the selected range in a marker pair, returning the new text and selection.
 * The selection is expanded outward so it never splits an existing marker (which
 * would leak raw tags like "[red]" into the preview), and applying the same marker
 * to an already-wrapped selection unwraps it instead of double-wrapping.
 */
export function wrapSelection(text: string, start: number, end: number, open: string, close = open) {
  for (const m of text.matchAll(MARKER)) {
    const s = m.index, e = s + m[0].length;
    if (start > s && start < e) start = s;
    if (end > s && end < e) end = e;
  }
  if (start >= open.length && text.slice(start - open.length, start) === open && text.slice(end, end + close.length) === close) {
    const next = text.slice(0, start - open.length) + text.slice(start, end) + text.slice(end + close.length);
    return { text: next, start: start - open.length, end: end - open.length };
  }
  const selected = text.slice(start, end);
  const next = text.slice(0, start) + open + selected + close + text.slice(end);
  return { text: next, start: start + open.length, end: end + open.length };
}
