/** Document Library tagging rules: creatable/learning types, contract types, sectors and copy audiences. */
export const DOC_TYPE_PRESETS = ["checklist", "contract", "terms", "reference"] as const;
export const CONTRACT_TYPE_PRESETS = ["New maintenance", "Contract renewal", "New sale & installation", "Comprehensive SLA", "Periodic inspection"] as const;
export const SECTORS = [
  { key: "all", label: "All sectors" },
  { key: "residential", label: "Residential" },
  { key: "commercial", label: "Commercial" },
  { key: "industrial", label: "Industrial" },
] as const;
export type Sector = (typeof SECTORS)[number]["key"];

const TYPE_LABELS: Record<string, string> = { checklist: "Checklist", contract: "Contract", terms: "Terms & conditions", reference: "Reference", other: "Reference" };
export const docTypeLabel = (kind: string) => TYPE_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
export const sectorLabel = (s: string) => SECTORS.find((x) => x.key === s)?.label ?? "All sectors";

/** Presets plus every value already used by the company, de-duplicated case-insensitively (learning dropdown). */
export function learnedOptions(presets: readonly string[], used: (string | null | undefined)[]): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const v of [...presets, ...used]) { const t = (v ?? "").trim(); if (!t || seen.has(t.toLowerCase())) continue; seen.add(t.toLowerCase()); out.push(t); }
  return out;
}
export const normalizeDocType = (v: string) => v.trim().toLowerCase().slice(0, 60);

/** Which copy a library preview opens on: a technician-only document opens on the technician view, never a blank client page. */
export function defaultCopyView(audience: string[] | null | undefined): "technician" | "client" {
  const a = audience ?? [];
  return a.length === 1 && a[0] === "technician" ? "technician" : "client";
}
export type CopyAudience = "technician" | "client" | "both";
export function copyAudience(audience: string[] | null | undefined): CopyAudience {
  const a = audience ?? [];
  return a.length === 1 ? (a[0] === "technician" ? "technician" : "client") : "both";
}

/** Tags required before a document can be published or saved as a copy. Returns the missing tag labels. */
export function missingTags(d: { kind: string; contract_type?: string | null; sector?: string | null }): string[] {
  const missing: string[] = [];
  if (!d.kind.trim()) missing.push("Type");
  if (!SECTORS.some((s) => s.key === d.sector)) missing.push("Sector");
  if (normalizeDocType(d.kind) === "contract" && !(d.contract_type ?? "").trim()) missing.push("Contract type");
  return missing;
}

/** Field attachments (assets, job sheets) list technician copies; agreements/renewals list client copies. */
export function fitsAttachment(audience: string[] | null | undefined, target: "field" | "client") {
  const a = copyAudience(audience);
  return a === "both" || a === (target === "field" ? "technician" : "client");
}
