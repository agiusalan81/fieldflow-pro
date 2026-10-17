/** Client document (PDF/email) template rules, shared by the settings editor and the email sender. */

export type DocType = "job_sheet" | "estimate" | "agreement";
export const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: "job_sheet", label: "Job sheets" },
  { key: "estimate", label: "Estimates" },
  { key: "agreement", label: "Maintenance agreements" },
];

export type BlockKey = "client" | "address" | "equipment" | "fault" | "work" | "timesheet" | "parts" | "notes" | "signoff";
export const BLOCKS: { key: BlockKey; label: string }[] = [
  { key: "client", label: "Client" },
  { key: "address", label: "Site address" },
  { key: "equipment", label: "Equipment" },
  { key: "fault", label: "Reported fault" },
  { key: "work", label: "Work carried out" },
  { key: "timesheet", label: "Time sheet" },
  { key: "parts", label: "Parts used" },
  { key: "notes", label: "Special notes" },
  { key: "signoff", label: "Technician & client sign-off" },
];

export type PdfTemplate = {
  order: BlockKey[];
  hidden: BlockKey[];
  header: string;
  footer: string;
  showTravel: boolean;
};
export const DEFAULT_TEMPLATE: PdfTemplate = { order: BLOCKS.map((b) => b.key), hidden: [], header: "", footer: "", showTravel: true };

export type Terms = Record<DocType, { enabled: boolean; text: string }>;
export const DEFAULT_TERMS: Terms = {
  job_sheet: { enabled: false, text: "" },
  estimate: { enabled: false, text: "" },
  agreement: { enabled: false, text: "" },
};

export type NotePreset = { label: string; text: string };

const isBlock = (v: unknown): v is BlockKey => BLOCKS.some((b) => b.key === v);

/** Reads a stored template, dropping unknown blocks and appending any new ones so nothing disappears. */
export function parseTemplate(raw: unknown): PdfTemplate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PdfTemplate>;
  const order = Array.isArray(r.order) ? r.order.filter(isBlock) : [];
  const seen = new Set(order);
  for (const b of BLOCKS) if (!seen.has(b.key)) order.push(b.key);
  return {
    order: [...new Set(order)],
    hidden: Array.isArray(r.hidden) ? r.hidden.filter(isBlock) : [],
    header: typeof r.header === "string" ? r.header : "",
    footer: typeof r.footer === "string" ? r.footer : "",
    showTravel: r.showTravel !== false,
  };
}

/** The blocks that will print, in order. */
export function visibleBlocks(t: PdfTemplate): BlockKey[] {
  return t.order.filter((b) => !t.hidden.includes(b));
}

export function parseTerms(raw: unknown): Terms {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Terms>;
  const out = { ...DEFAULT_TERMS };
  for (const { key } of DOC_TYPES) {
    const v = r[key];
    if (v && typeof v === "object") out[key] = { enabled: !!v.enabled, text: typeof v.text === "string" ? v.text : "" };
  }
  return out;
}

/** Terms text to print for a document type, or null when switched off or empty. */
export function termsFor(t: Terms, doc: DocType): string | null {
  const v = t[doc];
  return v.enabled && v.text.trim() ? v.text.trim() : null;
}

export function parsePresets(raw: unknown): NotePreset[] {
  return Array.isArray(raw)
    ? raw.filter((p): p is NotePreset => !!p && typeof p.label === "string" && typeof p.text === "string")
    : [];
}

export function moveBlock(order: BlockKey[], from: number, to: number): BlockKey[] {
  if (to < 0 || to >= order.length || from === to) return order;
  const next = [...order];
  const [b] = next.splice(from, 1);
  next.splice(to, 0, b!);
  return next;
}
