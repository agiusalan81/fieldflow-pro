// Meta WhatsApp template rules, shared by the drafter UI and the server submit.
export type WaCategory = "UTILITY" | "MARKETING";
export type WaDraft = { name: string; language: string; category: WaCategory; body: string; examples: string[]; notes: string };

export const MESSAGE_TYPES = [
  { key: "on_my_way", label: "Technician on the way", category: "UTILITY" as WaCategory },
  { key: "job_completed", label: "Job sheet completed", category: "UTILITY" as WaCategory },
  { key: "renewal", label: "Contract renewal reminder", category: "UTILITY" as WaCategory },
  { key: "estimate", label: "Estimate sent", category: "UTILITY" as WaCategory },
  { key: "custom_update", label: "Other service update", category: "UTILITY" as WaCategory },
  { key: "promotion", label: "Promotion / offer", category: "MARKETING" as WaCategory },
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "en_GB", label: "English (UK)" },
  { code: "mt", label: "Maltese" },
  { code: "it", label: "Italian" },
];

export function variableCount(body: string): number {
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

/** Returns a list of problems Meta would reject; empty means OK to submit. */
export function validateDraft(d: WaDraft): string[] {
  const errs: string[] = [];
  if (!/^[a-z0-9_]{1,512}$/.test(d.name)) errs.push("Name must use only lowercase letters, numbers and underscores.");
  if (!d.body.trim()) errs.push("Message text is empty.");
  if (d.body.length > 1024) errs.push("Message text must be 1024 characters or fewer.");
  const nums = [...d.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const n = variableCount(d.body);
  for (let i = 1; i <= n; i++) if (!nums.includes(i)) errs.push(`Placeholder {{${i}}} is missing — numbers must run in order.`);
  if (/\{\{(?!\d+\}\})/.test(d.body)) errs.push("Placeholders must look like {{1}}, {{2}}…");
  if (/^\s*\{\{\d+\}\}/.test(d.body) || /\{\{\d+\}\}\s*$/.test(d.body)) errs.push("The message can't start or end with a placeholder.");
  if (d.examples.length !== n || d.examples.some((e) => !e.trim())) errs.push("Each placeholder needs a sample value.");
  const words = d.body.replace(/\{\{\d+\}\}/g, " ").split(/\s+/).filter(Boolean).length;
  if (n > 0 && words < n * 3 + 3) errs.push("Too many placeholders for the amount of text — add more wording.");
  return errs;
}

export function previewDraft(d: Pick<WaDraft, "body" | "examples">): string {
  return d.body.replace(/\{\{(\d+)\}\}/g, (_, i) => d.examples[Number(i) - 1] || `{{${i}}}`);
}
