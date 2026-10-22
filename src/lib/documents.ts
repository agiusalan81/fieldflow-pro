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

export type TextLayerKey = "company" | "label" | "detail";
/** background: optional fill so the text reads like a button/badge ("" = none). */
export type TextLayer = { font: "document" | "sans" | "serif" | "mono"; color: string; bold: boolean; italic: boolean; background: string };
export type TextStyles = Record<TextLayerKey, TextLayer>;
export const TEXT_LAYERS: { key: TextLayerKey; label: string; hint: string }[] = [
  { key: "company", label: "Company name", hint: "\"Your Company\" at the top of the document" },
  { key: "label", label: "Field headings", hint: "Client, Site address, Equipment and other headings" },
  { key: "detail", label: "Field details & terms", hint: "The written details under each heading, and terms" },
];
export const DEFAULT_TEXT_STYLES: TextStyles = {
  company: { font: "document", color: "", bold: true, italic: false, background: "" },
  label: { font: "document", color: "", bold: true, italic: false, background: "" },
  detail: { font: "document", color: "", bold: false, italic: false, background: "" },
};
const LAYER_FONTS = ["document", "sans", "serif", "mono"] as const;
export function parseTextStyles(raw: unknown): TextStyles {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Partial<TextLayer>>;
  const one = (k: TextLayerKey): TextLayer => { const v = r[k] && typeof r[k] === "object" ? r[k] : {}; const d = DEFAULT_TEXT_STYLES[k]; return { font: LAYER_FONTS.includes(v.font as never) ? v.font as TextLayer["font"] : d.font, color: validColor(v.color, ""), bold: typeof v.bold === "boolean" ? v.bold : d.bold, italic: typeof v.italic === "boolean" ? v.italic : d.italic, background: validColor(v.background, "") }; };
  return { company: one("company"), label: one("label"), detail: one("detail") };
}
/** Colour a layer prints in: its own colour, else the existing template default. */
export function layerColor(t: PdfTemplate, k: TextLayerKey) {
  const own = t.textStyles?.[k]?.color; if (own) return own;
  return k === "label" ? t.primaryColor : t.fieldText || "#202020";
}

export type PdfTemplate = {
  order: BlockKey[];
  hidden: BlockKey[];
  header: string;
  footer: string;
  showTravel: boolean;
  stylePreset: "modern" | "technical" | "bold" | "classic" | "compact" | "service";
  primaryColor: string;
  accentColor: string;
  font: "sans" | "serif" | "mono";
  labels: Record<string, string>;
  documentFont?: "standard" | "lato" | "abel" | "custom" | undefined;
  fontPath?: string;
  fontName?: string;
  backgroundPath?: string;
  frame?: "none" | "line" | "double" | undefined;
  fieldBackground?: string;
  fieldText?: string;
  textStyles?: TextStyles;
  /** Resolved privately at read time, never saved. */
  fontData?: string | undefined;
  backgroundData?: string | undefined;
};
export const DOCUMENT_STYLES = ["modern", "technical", "bold", "classic", "compact", "service"] as const;
export const DEFAULT_TEMPLATE: PdfTemplate = { order: BLOCKS.map((b) => b.key), hidden: [], header: "", footer: "", showTravel: true, stylePreset: "modern", primaryColor: "#246654", accentColor: "#e4ad37", font: "sans", labels: {} };
export const FIELD_LABELS: Record<string, string> = { ...Object.fromEntries(BLOCKS.map((b) => [b.key, b.label])), site: "Site", model: "Model", serial: "Serial number", technician: "Technician", client_name: "Client name", asset_type: "Equipment type", internal: "Internal comments", pending: "Pending works", date: "Date", number: "Job sheet no." };
export const validColor = (v: unknown, fallback: string) => typeof v === "string" && /^#[\da-f]{6}$/i.test(v) ? v : fallback;
export function documentLabel(t: PdfTemplate, key: string) { return t.labels[key] || FIELD_LABELS[key] || key; }

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
    stylePreset: DOCUMENT_STYLES.includes(r.stylePreset as never) ? r.stylePreset as PdfTemplate["stylePreset"] : "modern",
    primaryColor: validColor(r.primaryColor, DEFAULT_TEMPLATE.primaryColor),
    accentColor: validColor(r.accentColor, DEFAULT_TEMPLATE.accentColor),
    font: r.font === "serif" || r.font === "mono" ? r.font : "sans",
    documentFont: ["lato", "abel", "custom"].includes(r.documentFont ?? "") ? r.documentFont : "standard",
    fontPath: typeof r.fontPath === "string" && /^[0-9a-f-]{36}\/fonts\/[\w.-]+$/.test(r.fontPath) ? r.fontPath : "",
    fontName: typeof r.fontName === "string" ? r.fontName.slice(0, 80) : "",
    backgroundPath: typeof r.backgroundPath === "string" && /^[0-9a-f-]{36}\/backgrounds\/[\w.-]+$/.test(r.backgroundPath) ? r.backgroundPath : "",
    frame: r.frame === "line" || r.frame === "double" ? r.frame : "none",
    fieldBackground: validColor(r.fieldBackground, "#ffffff"),
    fieldText: validColor(r.fieldText, "#202020"),
    textStyles: parseTextStyles(r.textStyles),
    labels: Object.fromEntries(Object.entries(r.labels && typeof r.labels === "object" ? r.labels : {}).filter(([k, v]) => k in FIELD_LABELS && typeof v === "string" && v.trim()).map(([k, v]) => [k, String(v).trim().slice(0, 80)])),
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
  if (b) next.splice(to, 0, b);
  return next;
}
