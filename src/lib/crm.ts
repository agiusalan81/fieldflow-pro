/** CRM pipeline rules shared by the board, lead panel and bell. */
export const CRM_STAGES = [
  { key: "new", label: "New lead" },
  { key: "contacted", label: "Contacted" },
  { key: "site_visit", label: "Site visit" },
  { key: "quote_sent", label: "Quote sent" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;
export type CrmStage = (typeof CRM_STAGES)[number]["key"];
export const OPEN_STAGES: CrmStage[] = ["new", "contacted", "site_visit", "quote_sent", "negotiation"];
export const stageLabel = (s: string) => CRM_STAGES.find((x) => x.key === s)?.label ?? s;
export const isClosed = (s: string) => s === "won" || s === "lost";

export const DEAL_TYPES = [
  { key: "repair", label: "Repair" },
  { key: "maintenance", label: "Maintenance contract" },
  { key: "installation", label: "New installation" },
  { key: "modernisation", label: "Modernisation" },
  { key: "inspection", label: "Inspection" },
  { key: "tender", label: "Tender" },
  { key: "other", label: "Other" },
] as const;
export const LEAD_SOURCES = [
  { key: "phone", label: "Phone call" },
  { key: "email", label: "Email" },
  { key: "walk_in", label: "Walk-in" },
  { key: "referral", label: "Referral" },
  { key: "portal", label: "Client portal" },
  { key: "website", label: "Website" },
] as const;

/** Display label for a stored lead source: built-in keys map to labels, custom sources show as typed. */
export function sourceLabel(source: string) {
  return LEAD_SOURCES.find((s) => s.key === source)?.label ?? source;
}
/** Built-in source labels followed by the company's own past sources, de-duplicated case-insensitively. */
export function sourceOptions(past: string[]) {
  const out: string[] = []; const seen = new Set<string>();
  for (const v of [...LEAD_SOURCES.map((s) => s.label), ...past.map(sourceLabel)]) {
    const t = v.trim(); const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
}

export type ActionType = { key: string; label: string; icon: string; dueHours: number; custom: boolean };
/** Built-in follow-up actions every company starts with; custom types are added per company. */
export const DEFAULT_ACTIONS: ActionType[] = [
  { key: "default:phone_call", label: "Phone call", icon: "phone", dueHours: 24, custom: false },
  { key: "default:whatsapp", label: "WhatsApp message", icon: "message", dueHours: 4, custom: false },
  { key: "default:site_inspection", label: "Site inspection", icon: "map", dueHours: 72, custom: false },
  { key: "default:send_quote", label: "Send quote", icon: "file", dueHours: 48, custom: false },
  { key: "default:revise_quote", label: "Revise quote", icon: "file", dueHours: 48, custom: false },
  { key: "default:meeting", label: "In-person meeting", icon: "users", dueHours: 120, custom: false },
  { key: "default:tender", label: "Tender submission", icon: "file", dueHours: 168, custom: false },
];
export function mergeActions(custom: { id: string; label: string; icon: string; due_hours: number; archived: boolean }[]): ActionType[] {
  return [...DEFAULT_ACTIONS, ...custom.filter((c) => !c.archived).map((c) => ({ key: `custom:${c.id}`, label: c.label, icon: c.icon, dueHours: c.due_hours, custom: true }))];
}

/** Default due time for an action: now + the action's offset, rounded up to the next quarter hour. */
export function defaultDue(action: Pick<ActionType, "dueHours">, now = new Date()) {
  const d = new Date(now.getTime() + action.dueHours * 3_600_000);
  const q = 15 * 60_000;
  return new Date(Math.ceil(d.getTime() / q) * q);
}

export type FollowupState = "done" | "overdue" | "due_today" | "upcoming";
export function followupState(f: { due_at: string; done_at: string | null }, now = new Date()): FollowupState {
  if (f.done_at) return "done";
  const due = new Date(f.due_at);
  if (due.getTime() < now.getTime()) return "overdue";
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return due.getTime() <= end.getTime() ? "due_today" : "upcoming";
}
/** Bell shows open follow-ups that are overdue or due today. */
export const needsAttention = (f: { due_at: string; done_at: string | null }, now = new Date()) => {
  const s = followupState(f, now); return s === "overdue" || s === "due_today";
};

export type WonTarget = "none" | "quote" | "job" | "contract";
/** Whether a won lead can convert to the chosen record. Jobs need a client. */
export function canConvert(target: WonTarget, lead: { client_id: string | null; quote_id: string | null; job_id: string | null }) {
  if (target === "job") return !!lead.client_id && !lead.job_id;
  if (target === "quote") return !lead.quote_id;
  return true;
}

export function pipelineTotals(leads: { stage: string; value: number | null }[]) {
  return Object.fromEntries(CRM_STAGES.map((s) => {
    const rows = leads.filter((l) => l.stage === s.key);
    return [s.key, { count: rows.length, value: rows.reduce((a, l) => a + (Number(l.value) || 0), 0) }];
  })) as Record<CrmStage, { count: number; value: number }>;
}

/** Per-member CRM access levels (mirrors DB crm_rank / crm_default_level). */
export const CRM_LEVELS = [
  { key: "none", label: "No access", detail: "CRM hidden" },
  { key: "viewer", label: "View only", detail: "See leads and follow-ups" },
  { key: "contributor", label: "Contributor", detail: "Add leads, notes and follow-ups" },
  { key: "closer", label: "Closer", detail: "Move stages, win/lose and convert" },
  { key: "manager", label: "CRM manager", detail: "Delete leads and manage follow-up types" },
] as const;
export type CrmLevel = (typeof CRM_LEVELS)[number]["key"];
export const crmRank = (l: string | null | undefined) => ({ viewer: 1, contributor: 2, closer: 3, manager: 4 } as Record<string, number>)[l ?? ""] ?? 0;
export const crmDefaultLevel = (role: string): CrmLevel => role === "superuser" || role === "admin" ? "manager" : role === "supervisor" ? "closer" : "none";
export const crmEffective = (role: string, explicit: string | null | undefined): CrmLevel => role === "superuser" ? "manager" : ((explicit as CrmLevel | null | undefined) ?? crmDefaultLevel(role));
export const crmAllows = (level: string | null | undefined, min: CrmLevel) => crmRank(level) >= crmRank(min);
/** Lead value display: unknown values read "TBD" rather than zero. */
export const leadValueLabel = (v: number | null | undefined, fmt: (n: number) => string) => v == null ? "TBD" : fmt(Number(v));
