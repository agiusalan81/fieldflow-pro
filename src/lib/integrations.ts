/** Tenant integrations: messaging channels, editable message templates and accounting connector settings. */
export const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp Business", providers: ["Meta Cloud API", "Twilio"] },
  { key: "sms", label: "SMS", providers: ["Twilio", "MessageBird", "Vonage"] },
  { key: "email", label: "Email", providers: ["Google Workspace", "Microsoft 365", "SMTP"] },
  { key: "signal", label: "Signal / Telegram / Teams (staff alerts)", providers: ["Telegram bot", "Microsoft Teams webhook", "Slack webhook", "Signal (self-hosted bridge)"] },
] as const;
export type ChannelKey = (typeof CHANNELS)[number]["key"];

export const ACCOUNTING = [
  { key: "zoho", label: "Zoho Books" },
  { key: "quickbooks", label: "QuickBooks Online" },
  { key: "xero", label: "Xero" },
  { key: "sage", label: "Sage Business Cloud" },
  { key: "webhook", label: "Custom webhook / Zapier" },
] as const;
export type AccountingKey = (typeof ACCOUNTING)[number]["key"];

export const EVENTS = [
  { key: "on_my_way", label: "Technician on the way", body: "Hi {{contact_name}}, technician {{technician_name}} is on the way. Should be there in approximately {{eta_window}} depending on traffic." },
  { key: "job_completed", label: "Job sheet completed", body: "Hi {{contact_name}}, {{technician_name}} has completed the service for {{asset_reference}} at {{site_name}}. Job sheet- {{jobsheet_number}} is attached. Questions? Call {{company_phone}}." },
  { key: "emergency_dispatch", label: "Emergency dispatch (in-app team chat)", body: "Urgent: job #{{job_number}} at {{site_address}} is assigned to you. Priority {{priority}}." },
  { key: "renewal_notice", label: "Contract renewal reminder", body: "Dear {{contact_name}}, your maintenance agreement for {{site_name}} expires on {{expiry_date}}. Your current contract and checklist are attached for renewal. Please review and sign digitally. Questions? Call {{company_phone}}." },
  { key: "estimate_sent", label: "Estimate sent", body: "Hello {{contact_name}}, please find estimate {{estimate_title}} for {{site_name}}. Total {{amount}}." },
] as const;
export type EventKey = (typeof EVENTS)[number]["key"];

export const MERGE_TAGS = ["client_name", "contact_name", "site_name", "site_address", "technician_name", "asset_reference", "jobsheet_number", "job_number", "priority", "eta_window", "expiry_date", "estimate_title", "amount", "company_name", "company_phone"] as const;

/** Everyday labels office staff see instead of {{tags}}. */
export const TAG_LABELS: Record<(typeof MERGE_TAGS)[number], string> = {
  client_name: "Client", contact_name: "Contact Person", site_name: "Site", site_address: "Site Address", technician_name: "Technician",
  asset_reference: "Equipment", jobsheet_number: "Job Sheet #", job_number: "Job #", priority: "Priority", eta_window: "Arrival Time",
  expiry_date: "Expiry Date", estimate_title: "Estimate", amount: "Amount", company_name: "Company Name", company_phone: "Office Phone",
};
/** Stored {{tag}} to editable "[Contact Person]". */
export function toFriendly(body: string): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in TAG_LABELS ? `[${TAG_LABELS[k as keyof typeof TAG_LABELS]}]` : m));
}
/** Editable "[Contact Person]" to stored {{tag}} (case-insensitive); unknown brackets stay as typed. */
export function fromFriendly(text: string): string {
  const rev = new Map(Object.entries(TAG_LABELS).map(([k, l]) => [l.toLowerCase(), k]));
  return text.replace(/\[([^\]]+)\]/g, (m, l: string) => { const k = rev.get(l.trim().toLowerCase()); return k ? `{{${k}}}` : m; });
}

export const SAMPLE: Record<string, string> = {
  client_name: "Grand Hotel Ltd", contact_name: "Sarah", site_name: "Tower Block A", site_address: "42 Marina Road, Sliema",
  technician_name: "Alan Agius", asset_reference: "Lift 2", jobsheet_number: "007611", job_number: "104", priority: "high",
  eta_window: "30 mins", expiry_date: "30/11/2026", estimate_title: "Door operator replacement", amount: "€450.00",
  company_name: "Your company", company_phone: "+356 2134 5678",
};

/** Replaces {{tag}} with values; unknown tags are left blank so clients never see raw braces. */
export function renderTemplate(body: string, values: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => values[k] ?? "");
}

export type Template = { enabled: boolean; channels: ChannelKey[]; body: string };
export type Integrations = {
  channels: Record<ChannelKey, { enabled: boolean; provider: string; sender: string }>;
  templates: Record<EventKey, Template>;
  accounting: { provider: AccountingKey | ""; require_review: boolean; income_account: string; labour_item: string; ot15_item: string; ot20_item: string; tax_rate: string; payment_terms: string; webhook_url: string; field_map: { from: string; to: string }[] };
};

/** Default channels per event; only fixed ones cannot be changed by tenants. */
export const FIXED_CHANNELS: Partial<Record<EventKey, ChannelKey[]>> = { emergency_dispatch: [] };
const DEFAULT_CHANNELS: Record<EventKey, ChannelKey[]> = { on_my_way: ["whatsapp"], job_completed: ["email"], emergency_dispatch: [], renewal_notice: ["whatsapp", "email"], estimate_sent: ["whatsapp", "email"] };

export function parseIntegrations(v: unknown): Integrations {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Integrations>;
  const channels = Object.fromEntries(CHANNELS.map((c) => [c.key, { enabled: false, provider: c.providers[0], sender: "", ...(o.channels?.[c.key] ?? {}) }])) as Integrations["channels"];
  const templates = Object.fromEntries(EVENTS.map((e) => [e.key, { enabled: true, channels: DEFAULT_CHANNELS[e.key], body: e.body, ...(o.templates?.[e.key] ?? {}), ...(e.key in FIXED_CHANNELS ? { channels: FIXED_CHANNELS[e.key as keyof typeof FIXED_CHANNELS] } : {}) }])) as Integrations["templates"];
  const accounting = { provider: "" as const, require_review: true, income_account: "", labour_item: "", ot15_item: "", ot20_item: "", tax_rate: "", payment_terms: "", webhook_url: "", field_map: [], ...(o.accounting ?? {}) };
  return { channels, templates, accounting };
}
