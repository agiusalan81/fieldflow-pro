/** Lift & escalator site measure / shaft survey model (Lifts & Escalators pack).
 * Steps mirror the on-site workflow; drafts normalise DB rows into editable string maps. */

export type SurveyKind = "lift" | "escalator" | "moving_walk";
export type SurveyPurpose = "new_installation" | "modernisation" | "replacement" | "assessment";

export const SURVEY_PURPOSES: { value: SurveyPurpose; label: string }[] = [
  { value: "new_installation", label: "New installation" },
  { value: "modernisation", label: "Modernisation" },
  { value: "replacement", label: "Replacement" },
  { value: "assessment", label: "Assessment / condition report" },
];

export const SURVEY_STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "finalised", label: "Finalised" },
  { key: "rfq_sent", label: "RFQ sent" },
  { key: "quoted", label: "Quoted" },
  { key: "converted", label: "Converted" },
  { key: "archived", label: "Archived" },
] as const;

export type DismantlingDetails = {
  scope?: string; // complete | partial
  scrap?: string; // client_keeps | company_disposes | scrap_credit
  hazmat?: string; // yes | no | unknown
  duration_days?: string;
  crew?: string;
  notes?: string;
};

export type FloorRow = {
  floor: string;
  height_mm: string;
  door_opening_mm: string;
  wall_thickness_mm: string;
  recess_mm: string;
  door_side: string;
};

export type SurveyDraft = {
  id: string;
  isNew: boolean;
  survey_kind: SurveyKind;
  purpose: SurveyPurpose;
  client_id: string; // "none" when unset
  site_id: string;
  asset_id: string;
  is_bare_shaft: boolean;
  requires_dismantling: boolean;
  dismantling: DismantlingDetails;
  geometry: Record<string, string>;
  floors: FloorRow[];
  power: Record<string, string>;
  modernisation: Record<string, string>;
  logistics: Record<string, string>;
  sketch: string | null;
  photos: string[];
  status: string;
  conducted_at: string;
};

export const GEOMETRY_FIELDS: { key: string; label: string; unit?: string; type?: "text" | "number" }[] = [
  { key: "pit_depth_mm", label: "Pit depth", unit: "mm", type: "number" },
  { key: "pit_condition", label: "Pit condition (dry, damp, flooded)" },
  { key: "pit_access", label: "Pit access (ladder, door)" },
  { key: "headroom_mm", label: "Headroom", unit: "mm", type: "number" },
  { key: "shaft_width_mm", label: "Shaft width", unit: "mm", type: "number" },
  { key: "shaft_depth_mm", label: "Shaft depth", unit: "mm", type: "number" },
  { key: "plumbness", label: "Shaft plumbness / deviations" },
  { key: "shaft_construction", label: "Shaft construction (concrete, blockwork, steel)" },
  { key: "ventilation", label: "Shaft ventilation" },
];

export const POWER_FIELDS: { key: string; label: string; type?: "text" | "number" }[] = [
  { key: "machine_location", label: "Machine location (room, MRL shaft top…)" },
  { key: "room_dims", label: "Machine room dimensions" },
  { key: "room_access", label: "Machine room access" },
  { key: "mains_voltage", label: "Mains supply (400V 3-phase…)" },
  { key: "isolator", label: "Main isolator present & accessible" },
  { key: "shaft_lighting", label: "Shaft lighting" },
];

export const MODERNISATION_ITEMS = ["rails", "counterweight", "machine", "doors", "cabin", "safety_gear", "buffers"] as const;
export const MODERNISATION_CHOICES = ["keep", "refurbish", "replace"] as const;

export const LOGISTICS_FIELDS: { key: string; label: string }[] = [
  { key: "crane_access", label: "Crane / lifting access" },
  { key: "entry_route", label: "Entry route for material (door widths, stairs)" },
  { key: "storage_area", label: "On-site storage area" },
  { key: "scaffolding", label: "Scaffolding / working platform needed" },
];

export const emptyFloor = (floor: string): FloorRow => ({ floor, height_mm: "", door_opening_mm: "", wall_thickness_mm: "", recess_mm: "", door_side: "" });

/** Total travel in mm = sum of floor-to-floor heights. */
export function travelFromFloors(floors: FloorRow[]): number {
  return floors.reduce((sum, f) => sum + (Number(f.height_mm) || 0), 0);
}

/** Normalises a lift_surveys row (or null) into an editable draft. */
export function normalizeSurvey(row: Record<string, unknown> | null | undefined): SurveyDraft {
  const strMap = (v: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (val != null && val !== "") out[k] = String(val);
    }
    return out;
  };
  const floorsRaw = row?.["floor_heights"];
  const floors: FloorRow[] = Array.isArray(floorsRaw)
    ? floorsRaw.filter((f) => f && typeof f === "object").map((f) => ({ ...emptyFloor(""), ...(f as Record<string, string>) }))
    : [];
  return {
    id: String(row?.["id"] ?? crypto.randomUUID()),
    isNew: !row?.["id"],
    survey_kind: (row?.["survey_kind"] as SurveyKind | undefined) ?? "lift",
    purpose: (row?.["purpose"] as SurveyPurpose | undefined) ?? "new_installation",
    client_id: (row?.["client_id"] as string | undefined) ?? "none",
    site_id: (row?.["site_id"] as string | undefined) ?? "none",
    asset_id: (row?.["asset_id"] as string | undefined) ?? "none",
    is_bare_shaft: row?.["is_bare_shaft"] !== false,
    requires_dismantling: row?.["requires_dismantling"] === true,
    dismantling: strMap(row?.["dismantling_details"]) as DismantlingDetails,
    geometry: strMap(row?.["geometry"]),
    floors,
    power: strMap(row?.["power_supply"]),
    modernisation: strMap(row?.["modernisation_assessment"]),
    logistics: strMap(row?.["logistics"]),
    sketch: (row?.["sketch"] as string | null | undefined) ?? null,
    photos: Array.isArray(row?.["photos"]) ? (row!["photos"] as string[]) : [],
    status: (row?.["status"] as string | undefined) ?? "draft",
    conducted_at: (row?.["conducted_at"] as string | undefined) ?? "",
  };
}

/** Client-facing estimate line injected when an existing lift must be dismantled. */
export function dismantlingLine(d: DismantlingDetails): string {
  const parts = ["Decommissioning, dismantling & safe removal of existing lift"];
  if (d.scope === "partial") parts.push("partial scope");
  if (d.scrap === "company_disposes") parts.push("incl. carting & disposal");
  if (d.scrap === "scrap_credit") parts.push("scrap value credited");
  if (d.hazmat === "yes") parts.push("hazardous material handling");
  if (d.duration_days) parts.push(`approx. ${d.duration_days} day(s)`);
  return parts.join(" — ");
}

/** Maps a finalised survey onto supplier-RFQ spec values (lift_estimates rfq.values keys). */
export function rfqPrefillFromSurvey(d: SurveyDraft): Record<string, string> {
  if (d.survey_kind !== "lift") return {};
  const g = d.geometry;
  const out: Record<string, string> = {};
  const put = (key: string, v: string | undefined) => { if (v) out[key] = v; };
  put("stops", d.floors.length ? String(d.floors.length) : undefined);
  put("pit", g["pit_depth_mm"]);
  put("headroom", g["headroom_mm"]);
  put("shaft_w", g["shaft_width_mm"]);
  put("shaft_d", g["shaft_depth_mm"]);
  const travel = travelFromFloors(d.floors);
  if (travel > 0) out["travel"] = String(travel);
  const heights = d.floors.map((f) => f.height_mm).filter(Boolean).join(", ");
  if (heights) out["floor_heights"] = heights;
  put("voltage", d.power["mains_voltage"]);
  return out;
}

/** Next survey reference like SV-0007 for a company. */
export function nextSurveyNumber(existing: string[]): string {
  const max = existing.reduce((m, s) => {
    const n = Number((s.match(/(\d+)\s*$/) ?? [])[1]);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `SV-${String(max + 1).padStart(4, "0")}`;
}
