/** Pure rules for the hotel/store space configurator (sandbox before saving). */
export type Floor = { id: string; label: string; start: number; count: number; zone: string };
export type Space = { floor: string; name: string; zone: string };
export type EquipmentBundle = { name: string; count: number };

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

export function assetRows(spaces: Space[], equipment: (string | EquipmentBundle)[]) {
  return spaces.flatMap((s) => equipment.flatMap((item) => {
    const e=typeof item==='string'?{name:item,count:1}:item;
    return Array.from({length:Math.max(0,Math.min(500,Math.floor(e.count)))},(_,i)=>({reference_number:`${s.name} · ${e.name}${e.count>1?` ${String(i+1).padStart(2,'0')}`:''}`,asset_category:e.name,location_details:`${s.floor} · ${s.zone} · ${s.name}`}));
  }));
}
