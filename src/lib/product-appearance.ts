import type { Edition } from "@/lib/editions";

export type TextStyle = { font: string; size: number; bold: boolean; italic: boolean; underline: boolean; color: string };
export type Palette = { background: string; fieldBackground: string; fieldBorder: string; primary: string; menuBackground: string; buttonBackground: string; buttonText: string };
export type ZoneKey = "heading" | "fieldTitle" | "fieldText" | "menuHeader" | "menuLink" | "button";
export type ProductAppearance = { palette: Palette; zones: Record<ZoneKey, TextStyle> };

export const ZONES: { key: ZoneKey; label: string; selector: string }[] = [
  { key: "heading", label: "Page & card headings", selector: "main h1, main h2, main h3, .fieldbridge-header h1" },
  { key: "fieldTitle", label: "Field titles", selector: "main label" },
  { key: "fieldText", label: "Field entries", selector: "input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]), textarea, select, button[role=combobox]" },
  { key: "menuHeader", label: "Menu section titles", selector: ".tenant-menu button" },
  { key: "menuLink", label: "Menu links", selector: ".tenant-menu a" },
  { key: "button", label: "Buttons", selector: "main button.bg-primary" },
];

export const FONTS = [
  { id: "inherit", label: "App default", css: "inherit" },
  { id: "sans", label: "Modern sans", css: "system-ui, sans-serif" },
  { id: "serif", label: "Editorial serif", css: "\"Lora\", Georgia, serif" },
  { id: "grotesk", label: "Grotesk", css: "\"Space Grotesk\", system-ui, sans-serif" },
  { id: "archivo", label: "Archivo", css: "\"Archivo\", system-ui, sans-serif" },
  { id: "mono", label: "Monospace", css: "ui-monospace, monospace" },
];

export const SWATCHES = ["#ffffff", "#f1f5f9", "#cbd5e1", "#64748b", "#334155", "#0f2942", "#1e3a5f", "#2563eb", "#3b82f6", "#60a5fa", "#0f766e", "#16a34a", "#d97706", "#dc2626", "#111827", "#000000"];

const t = (color: string, size: number, bold = false, font = "inherit"): TextStyle => ({ font, size, bold, italic: false, underline: false, color });

const HOTEL: ProductAppearance = {
  palette: { background: "#ffffff", fieldBackground: "#ffffff", fieldBorder: "#cbd5e1", primary: "#1e3a5f", menuBackground: "#ffffff", buttonBackground: "#475569", buttonText: "#ffffff" },
  zones: { heading: t("#0f2942", 0, true, "serif"), fieldTitle: t("#0f2942", 14, true), fieldText: t("#3b82f6", 15), menuHeader: t("#0f2942", 13, true), menuLink: t("#1e3a5f", 14), button: t("#ffffff", 14, true) },
};
const EMPTY: ProductAppearance = {
  palette: { background: "", fieldBackground: "", fieldBorder: "", primary: "", menuBackground: "", buttonBackground: "", buttonText: "" },
  zones: { heading: t("", 0), fieldTitle: t("", 0), fieldText: t("", 0), menuHeader: t("", 0), menuLink: t("", 0), button: t("", 0) },
};

export function defaultAppearance(edition: Edition): ProductAppearance { return structuredClone(edition === "hotel" ? HOTEL : EMPTY); }

/** Merges a stored (possibly partial) value onto edition defaults. */
export function mergeAppearance(edition: Edition, stored: unknown): ProductAppearance {
  const base = defaultAppearance(edition);
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<ProductAppearance>;
  const zones = { ...base.zones };
  for (const z of ZONES) zones[z.key] = { ...base.zones[z.key], ...(s.zones?.[z.key] ?? {}) };
  return { palette: { ...base.palette, ...(s.palette ?? {}) }, zones };
}

const HEX = /^#[0-9a-f]{3,8}$/i;
const c = (v: string) => (HEX.test(v) ? v : "");

/** Builds a stylesheet scoped to one edition; unset values leave the app default. */
export function appearanceCss(edition: Edition, a: ProductAppearance): string {
  const root = `html[data-edition="${edition}"]:not(.dark)`;
  const p = a.palette; const out: string[] = [];
  const vars = [["--background", c(p.background)], ["--card", c(p.background)], ["--primary", c(p.primary)], ["--ring", c(p.primary)], ["--sidebar", c(p.menuBackground)], ["--tenant-input-background", c(p.fieldBackground)], ["--input", c(p.fieldBorder)]].filter(([, v]) => v);
  if (vars.length) out.push(`${root}{${vars.map(([k, v]) => `${k}:${v} !important`).join(";")}}`);
  if (c(p.menuBackground)) {
    out.push(`${root} .tenant-menu{background-color:${p.menuBackground};background-image:none}`);
    // Keep menu text, brand title, footer and the active pill readable on the chosen menu colour.
    const ink = isLight(p.menuBackground) ? (c(a.zones.menuHeader.color) || "#0f2942") : "#ffffff";
    const pill = isLight(p.menuBackground) ? (c(p.primary) || "#1e3a5f") : "rgba(255,255,255,.18)";
    out.push(`${root}{--sidebar-foreground:${ink} !important;--sidebar-accent:${pill} !important;--sidebar-accent-foreground:#ffffff !important;--sidebar-border:${isLight(p.menuBackground) ? "#e2e8f0" : "rgba(255,255,255,.15)"} !important}`);
  }
  if (c(p.buttonBackground)) out.push(`${root} ${ZONES[5]!.selector}{background-color:${p.buttonBackground}}`);
  if (c(p.fieldBorder)) out.push(`${root} ${ZONES[2]!.selector}{border-color:${p.fieldBorder}}`);
  for (const z of ZONES) {
    const s = a.zones[z.key]; const font = FONTS.find(f => f.id === s.font);
    const color = z.key === "button" ? c(p.buttonText) || c(s.color) : c(s.color);
    const rules = [color && `color:${color}`, font && font.id !== "inherit" && `font-family:${font.css}`, s.size >= 8 && s.size <= 48 && `font-size:${s.size}px`, s.bold && "font-weight:700", s.italic && "font-style:italic", s.underline && "text-decoration:underline"].filter(Boolean);
    if (rules.length) out.push(`${root} :is(${z.selector}){${rules.join(";")}}`);
  }
  if (c(a.zones.fieldText.color)) out.push(`${root} :is(input,textarea)::placeholder{color:${a.zones.fieldText.color};opacity:.55}`);
  out.push(`${root} .tenant-menu a[data-status=active],${root} .tenant-menu a[data-status=active] *{color:var(--sidebar-accent-foreground) !important}`);
  return out.join("\n");
}

/** True when a hex colour is light enough to need dark text on top. */
export function isLight(hex: string): boolean {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.6;
}
