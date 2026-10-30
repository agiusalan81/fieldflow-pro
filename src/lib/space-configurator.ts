/** Pure rules for the hotel/store space configurator (sandbox before saving). */
export type Floor = { id: string; label: string; start: number; count: number; zone: string };
export type Space = { floor: string; name: string; zone: string };

export function buildSpaces(floors: Floor[], prefix: string): Space[] {
  return floors.flatMap((f) => Array.from({ length: Math.max(0, Math.min(500, f.count)) }, (_, i) => ({
    floor: f.label, zone: f.zone, name: `${prefix}${f.start + i}`.trim(),
  })));
}

/** Next floor continues numbering at the next hundred (101 → 201). */
export function nextFloor(floors: Floor[], defaultZone: string): Floor {
  const last = floors[floors.length - 1];
  const n = floors.length + 1;
  const start = last ? (Math.floor(last.start / 100) + 1) * 100 + 1 : 101;
  return { id: crypto.randomUUID(), label: `Floor ${n}`, start, count: last?.count ?? 10, zone: last?.zone ?? defaultZone };
}

export function assetRows(spaces: Space[], equipment: string[]) {
  return spaces.flatMap((s) => equipment.map((e) => ({ reference_number: `${s.name} · ${e}`, asset_category: e, location_details: `${s.floor} · ${s.zone} · ${s.name}` })));
}
