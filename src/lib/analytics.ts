export const ANALYTICS_FEATURES = ["job_sheets", "dispatch", "daily_reports", "inventory", "contracts", "estimates", "technical_library", "standby", "team_chat", "company_settings", "subscription"] as const;
export const OUTREACH_TOKENS = ["product_name", "product_domain", "contact_name", "company_name", "support_email", "founder_name", "trial_days_left"] as const;
export const DEFAULT_OUTREACH = [
  { key: "setup", name: "Assisted setup", subject: "Getting started with {{product_name}}", body: "Hi {{contact_name}}, would a short setup call or help importing your equipment make it easier to get started with {{product_name}}? Tell us what is holding your team back." },
  { key: "value", name: "ROI review", subject: "Your team's next step with {{product_name}}", body: "Hi {{contact_name}}, let's review how {{product_name}} could save your team time and reduce missed labour. Would you like a short review of your workflow and the available plans?" },
  { key: "unlock", name: "Explore another module", subject: "Explore more of {{product_name}}", body: "Hi {{contact_name}}, is there a feature your team needs before deciding on {{product_name}}? Let us know and we can discuss a short, approved module trial." },
  { key: "feedback", name: "Before you go", subject: "Your feedback on {{product_name}}", body: "Hi {{contact_name}}, what would {{product_name}} have needed for your team to stay? We would appreciate your feedback, even if it is not the right fit today. You can reply or contact {{support_email}}." },
] as const;
export function renderOutreach(text: string, values: Record<string, string>) {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`);
}
export function unknownTokens(text: string) {
  return [...new Set([...text.matchAll(/\{\{([a-z_]+)\}\}/g)].map(m => m[1] ?? "").filter(key => !OUTREACH_TOKENS.some(t => t === key)))];
}
export type HealthTenant = { status: string; created_at: string; trial_ends_at: string; first_sign_in: string | null; last_seen: string | null; work_count: number; active_days: number };
export function tenantAlerts(t: HealthTenant, now = Date.now()) {
  const alerts: { key: string; label: string; actions: string[] }[] = [];
  const day = 86400000;
  if (t.first_sign_in && t.work_count === 0 && now - new Date(t.first_sign_in).getTime() >= 3 * day) alerts.push({ key: "stalled", label: "Signed in, no work after 3 days", actions: ["setup", "feedback", "unlock"] });
  if (t.status === "trial" && t.last_seen && now - new Date(t.last_seen).getTime() >= 7 * day) alerts.push({ key: "inactive", label: "Trial inactive for 7 days", actions: ["setup", "feedback", "value"] });
  const left = (new Date(t.trial_ends_at).getTime() - now) / day;
  if (t.status === "trial" && left >= 0 && left <= 7) alerts.push({ key: "ending", label: "Trial ends within 7 days", actions: ["value", "feedback", "unlock"] });
  if (t.status === "trial" && left < 0) alerts.push({ key: "expired", label: "Trial expired", actions: ["feedback", "setup", "value"] });
  if (t.work_count >= 20 && t.active_days >= 5) alerts.push({ key: "engaged", label: "Highly engaged team", actions: ["value", "unlock", "feedback"] });
  return alerts;
}
/** Only coarse feature keys leave the browser; never route parameters or query strings. */
export function analyticsFeature(path: string): typeof ANALYTICS_FEATURES[number] | null {
  if (/^\/(sheets|print)(\/|$)/.test(path)) return "job_sheets";
  const paths: Record<string, typeof ANALYTICS_FEATURES[number]> = { "/admin/jobs": "dispatch", "/schedule": "dispatch", "/available-jobs": "dispatch", "/dwr": "daily_reports", "/admin/inventory": "inventory", "/contracts": "contracts", "/estimates": "estimates", "/proposals": "estimates", "/technical-library": "technical_library", "/standby": "standby", "/messages": "team_chat", "/company": "company_settings", "/subscription": "subscription" };
  return paths[path] ?? null;
}