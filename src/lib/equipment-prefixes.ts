import type { Edition } from "@/lib/editions";

/** Industry default ID prefixes per equipment type; tenants can override or add their own. */
export const INDUSTRY_PREFIXES: Record<Edition, Record<string, string>> = {
  hotel: {
    Room: "RM", Fridge: "FR", Minibar: "MB", "Air conditioning unit": "AC", TV: "TV", Safe: "SF",
    "Door lock / key card": "LK", Lighting: "LT", Boiler: "BL", "Water heater": "WH", Kettle: "KT", "Hair dryer": "HD",
  },
  retail: {
    Fridge: "FR", "Multideck chiller": "MD", Freezer: "FZ", Oven: "OV", Proofer: "PR", "Deli counter": "DL",
    Scale: "SC", "Air conditioning unit": "AC", "POS / Register": "POS", "Roller shutter": "RS", Lighting: "LT", "Ice maker": "IM",
  },
  contractor: {
    "Passenger Lift": "PL", "Goods Lift": "GL", "Hydraulic Lift": "HL", Escalator: "ESC", "Moving walk": "MW",
    "Platform lift": "PFL", Dumbwaiter: "DW", Generator: "GEN", Pump: "PMP", "Air conditioning unit": "AC",
  },
};

const key = (s: string) => s.trim().toLowerCase();

/** Derive a 2-3 letter prefix from an unlisted equipment name: "Ice maker" → IM, "Fridge" → FR. */
export function derivePrefix(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "EQ";
  if (words.length > 1) return words.slice(0, 3).map((w) => w[0]).join("");
  const w = words[0]!;
  const consonants = w.slice(1).replace(/[AEIOU]/g, "");
  return (w[0]! + (consonants[0] ?? w[1] ?? "")).slice(0, 2) || "EQ";
}

/** Tenant override → industry default → derived. Always 1-6 uppercase letters/numbers. */
export function prefixFor(name: string, edition: Edition, overrides: Record<string, string> = {}): string {
  const find = (m: Record<string, string>) => Object.entries(m).find(([k]) => key(k) === key(name))?.[1];
  const raw = find(overrides) ?? find(INDUSTRY_PREFIXES[edition]) ?? derivePrefix(name);
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return clean || "EQ";
}

/** Next numbers per prefix, continuing from existing tags (FR-03 exists → FR-04). */
export function sequenceTags(prefixes: string[], existing: string[], separator: string, padding: number): string[] {
  const next = new Map<string, number>();
  return prefixes.map((p) => {
    const lead = p + separator;
    if (!next.has(lead)) next.set(lead, existing.reduce((n, t) => { const b = t.toUpperCase().startsWith(lead) ? t.slice(lead.length) : ""; return /^\d+$/.test(b) ? Math.max(n, Number(b)) : n; }, 0));
    const n = next.get(lead)! + 1; next.set(lead, n);
    return `${lead}${String(n).padStart(padding, "0")}`;
  });
}
