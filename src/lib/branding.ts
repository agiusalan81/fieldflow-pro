import type { CSSProperties } from "react";
import { validColor } from "./documents";

export const ICON_PRESETS = ["outline", "strong", "duotone"] as const;
export const INDUSTRY_PRESETS = ["general", "lifts", "hvac", "electrical", "plumbing"] as const;
export const INDUSTRY_LABELS = { general: "General field service", lifts: "Lifts & escalators", hvac: "Heating & cooling", electrical: "Electrical", plumbing: "Plumbing" };
export type Appearance = { backgroundPath: string; menuBackgroundPath: string; fieldBackground: string; fieldText: string; iconPreset: typeof ICON_PRESETS[number]; industryPreset: typeof INDUSTRY_PRESETS[number]; backgroundData?: string; menuBackgroundData?: string };
export const DEFAULT_APPEARANCE: Appearance = { backgroundPath: "", menuBackgroundPath: "", fieldBackground: "", fieldText: "", iconPreset: "outline", industryPreset: "general" };
export function brandPath(v: unknown) { return typeof v === "string" && /^[0-9a-f-]{36}\/(backgrounds|fonts)\/[a-zA-Z0-9._-]+$/.test(v) ? v : ""; }
export function parseAppearance(raw: unknown): Appearance {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Appearance>;
  return { backgroundPath: brandPath(r.backgroundPath), menuBackgroundPath: brandPath(r.menuBackgroundPath), fieldBackground: validColor(r.fieldBackground, ""), fieldText: validColor(r.fieldText, ""), iconPreset: ICON_PRESETS.includes(r.iconPreset as never) ? r.iconPreset as Appearance["iconPreset"] : "outline", industryPreset: INDUSTRY_PRESETS.includes(r.industryPreset as never) ? r.industryPreset as Appearance["industryPreset"] : "general" };
}
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return (c[0] ?? 0) * .2126 + (c[1] ?? 0) * .7152 + (c[2] ?? 0) * .0722; };
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function appearanceVariables(a: Appearance): CSSProperties {
  return { "--tenant-background-image": a.backgroundData ? `url("${a.backgroundData}")` : "none", "--tenant-menu-image": a.menuBackgroundData ? `url("${a.menuBackgroundData}")` : "none", "--tenant-input-background": a.fieldBackground || undefined, "--tenant-input-text": a.fieldText || undefined } as CSSProperties;
}
export function industrySheetLabel(preset: Appearance["industryPreset"], label: string) {
  const noun = preset === "lifts" ? "Job sheets" : preset === "hvac" ? "HVAC service sheets" : preset === "electrical" ? "Electrical service sheets" : preset === "plumbing" ? "Plumbing service sheets" : "Job sheets";
  return label.includes("job sheets") ? label.replace("job sheets", noun.toLowerCase()) : label === "Job sheets" ? noun : label;
}