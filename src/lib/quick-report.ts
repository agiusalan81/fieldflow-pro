/** Tap-first public QR reporting: category → optional symptom → send. Text stays optional. */
export const STORE_SYMPTOMS: Record<string, string[]> = {
  "Floors & tiles": ["Cracked tile", "Loose tile", "Trip hazard"],
  "Spill or trip hazard": ["Liquid spill", "Broken glass", "Obstruction"],
  "Toilets & washrooms": ["Blocked toilet", "Leaking tap", "No soap / paper"],
  "Lighting & electrics": ["Light out", "Flickering", "Sparks / burning smell"],
  "Doors, shutters & entrances": ["Won't open", "Won't close", "Sensor not working"],
  "Ceilings, walls & leaks": ["Water leak", "Stain / damp", "Damaged panel"],
  "Trolleys & car park": ["Barrier stuck", "Lighting out", "Damaged trolley"],
  "Fridges & freezers": ["Not cold", "Ice build-up", "Alarm sounding"],
  "Other": [],
};
export const EQUIPMENT_SYMPTOMS = ["Not working", "Strange noise", "Leaking", "Damaged", "Error / alarm", "Other"];

/** Server requires ≥5 chars: compose category + symptom + optional note. */
export function composeProblem(parts: { category?: string; symptom?: string; note?: string }) {
  const head = [parts.category, parts.symptom].filter(Boolean).join(" — ");
  const text = [head, parts.note?.trim()].filter(Boolean).join(": ");
  return text.length >= 5 ? text.slice(0, 2000) : `${text || "Problem"} reported`.slice(0, 2000);
}

/** Anonymous reports still satisfy required name fields without inventing a person. */
export function reporterFields(name: string) {
  const n = name.trim().split(/\s+/).filter(Boolean);
  return { first: n[0] ?? "Anonymous", last: n.slice(1).join(" ") || "(QR scan)", position: "Not given" };
}
