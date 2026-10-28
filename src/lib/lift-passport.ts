/** Lift & escalator technical passport field model (tenant-only). Every field auto-suggests,
 * learns from company history, and accepts "N/A" plus custom entries. */

export type PassportEquipmentType = "lift" | "escalator" | "moving_walk";
export type DriveType = "" | "traction" | "hydraulic" | "screw" | "na";

export type PassportField = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[] | undefined;
  unit?: string | undefined;
  /** Lift only: field shows only for these drive types. */
  drives?: DriveType[] | undefined;
};
export type PassportSection = { key: string; title: string; fields: PassportField[] };

const sel = (key: string, label: string, options: string[], drives?: DriveType[]): PassportField => ({ key, label, type: "select", options, drives });
const num = (key: string, label: string, unit?: string, drives?: DriveType[]): PassportField => ({ key, label, type: "number", unit, drives });
const txt = (key: string, label: string, drives?: DriveType[]): PassportField => ({ key, label, type: "text", drives });

export const NA = "N/A";

const LIFT_GENERAL: PassportSection = {
  key: "general",
  title: "General & performance",
  fields: [
    txt("lift_ref", "Lift reference / ID"),
    txt("serial_number", "Serial number"),
    txt("location_details", "Location details"),
    sel("manufacturer", "Manufacturer", ["Kone", "Otis", "Schindler", "TK Elevator", "Mitsubishi", "Fujitec", "Hyundai", "Kleemann", "Orona", "GMV", "Locally assembled"]),
    num("year_installed", "Year installed"),
    sel("lift_type", "Lift type", ["Passenger", "Goods / Passenger", "Service / Stretcher", "Bed / Hospital", "Panoramic / Glass", "Home lift / Platform", "Dumbwaiter"]),
    sel("rated_load", "Rated load", ["320 kg", "450 kg", "630 kg", "800 kg", "1000 kg", "1275 kg", "1600 kg", "2000 kg"]),
    sel("rated_speed", "Rated speed", ["0.5 m/s", "0.63 m/s", "1.0 m/s", "1.6 m/s", "2.0 m/s", "2.5 m/s"]),
    num("stops", "Stops"),
    num("entrances", "Entrances"),
  ],
};

const LIFT_MACHINE: PassportSection = {
  key: "machine_drive",
  title: "Machine & drive gear",
  fields: [
    sel("machine_brand", "Machine brand", ["Montanari", "Alberto Sassi", "Akış", "Ziehl-Abegg", "Sicor", "Wittur"], ["traction"]),
    txt("machine_model", "Machine model", ["traction"]),
    sel("machine_location", "Machine location", ["Machine room", "MRL — shaft top", "MRL — shaft side", "MRL — shaft bottom"], ["traction"]),
    num("motor_kw", "Motor power", "kW", ["traction"]),
    txt("brake_spec", "Brake specification", ["traction"]),
    sel("gearbox_oil", "Gearbox oil", ["N/A — gearless", "ISO VG 220", "ISO VG 320"], ["traction"]),
    sel("pump_brand", "Pump / power unit brand", ["GMV", "Blain", "Bucher", "Moris", "Omega"], ["hydraulic"]),
    sel("valve_block", "Valve block", ["GMV 3010", "GMV NGV", "Blain EV100", "Bucher LRV"], ["hydraulic"]),
    sel("cylinder_type", "Cylinder type", ["Direct 1:1", "Roped 2:1", "Telescopic"], ["hydraulic"]),
    sel("piston_brand", "Piston / cylinder brand", ["GMV", "Moris", "Bucher", "Omar Lifts", "Algi", "Wittur"], ["hydraulic"]),
    num("piston_diameter", "Piston diameter", "mm", ["hydraulic"]),
    sel("oil_grade", "Hydraulic oil grade", ["ISO VG 32", "ISO VG 46", "ISO VG 68"], ["hydraulic"]),
    num("tank_volume", "Tank volume", "L", ["hydraulic"]),
    sel("rupture_valve", "Rupture valve", ["Fitted", "N/A"], ["hydraulic"]),
  ],
};

const LIFT_SUSPENSION: PassportSection = {
  key: "suspension_safety",
  title: "Suspension, ropes & safety gear",
  fields: [
    sel("roping_ratio", "Roping ratio", ["1:1", "2:1", "N/A"]),
    num("rope_count", "Rope / belt count"),
    num("rope_diameter", "Rope diameter", "mm"),
    sel("rope_type", "Suspension type", ["Steel wire ropes", "Coated steel ropes", "Steel belts", "N/A — hydraulic"]),
    sel("governor", "Overspeed governor", ["PFB", "Sabis", "Hansa", "Dynatec", "Manufacturer standard"]),
    sel("safety_gear", "Safety gear", ["Progressive", "Instantaneous", "N/A"]),
    sel("buffers", "Buffers", ["Hydraulic", "Polyurethane", "Spring"]),
  ],
};

const LIFT_CONTROLLER: PassportSection = {
  key: "controller_electronics",
  title: "Controller & electronics",
  fields: [
    sel("controller", "Controller", ["Arkel ARL-500", "Arkel Arcube", "KEB", "STEP", "Monarch", "Manufacturer standard"]),
    sel("inverter", "Inverter / VFD", ["Fuji", "Yaskawa", "KEB", "Ziehl-Abegg", "Integrated in controller", "N/A"]),
    sel("position_feedback", "Position feedback", ["Encoder", "Tape reader", "Magnetic switches"]),
    sel("autodialler", "Autodialler", ["Fitted — GSM", "Fitted — landline", "N/A"]),
    sel("mains_supply", "Mains supply", ["400V 3-phase 50Hz", "230V 1-phase", "415V 3-phase"]),
    sel("ard", "Automatic rescue device (ARD)", ["Fitted", "N/A"]),
  ],
};

const LIFT_DOORS: PassportSection = {
  key: "doors_cabin",
  title: "Doors & cabin",
  fields: [
    sel("door_operator", "Door operator", ["Wittur", "Fermator", "AHZ", "AHZ Plus", "Selcom", "Sematic", "Prisma", "Meiller"]),
    sel("clear_opening", "Clear opening", ["700 mm", "800 mm", "900 mm", "1000 mm", "1100 mm", "1200 mm"]),
    sel("door_configuration", "Door configuration", ["2-panel centre", "2-panel telescopic", "3-panel telescopic", "4-panel centre", "Single swing"]),
    sel("landing_locks", "Landing locks", ["Wittur", "Fermator", "AHZ", "Selcom", "Sematic", "Prisma"]),
    num("landing_doors", "Landing doors (independent of stops)"),
    sel("safety_edge", "Safety edge", ["Light curtain", "Mechanical edge", "Both", "N/A"]),
    sel("car_top_controls", "Car top inspection controls", ["Fitted", "N/A"]),
  ],
};

const ESC_GENERAL: PassportSection = {
  key: "general",
  title: "General & geometry",
  fields: [
    txt("escalator_ref", "Escalator / walk reference"),
    txt("serial_number", "Serial number"),
    txt("location_details", "Location details"),
    sel("manufacturer", "Manufacturer", ["Otis", "Schindler", "Kone", "TK Elevator", "Mitsubishi", "Fujitec", "Hyundai", "Orona"]),
    num("year_installed", "Year installed"),
    sel("escalator_type", "Type", ["Escalator", "Moving walk — inclined", "Moving walk — flat"]),
    sel("inclination", "Inclination", ["30°", "35°", "0°–6°", "10°–12°"]),
    num("rise", "Vertical rise", "mm"),
    num("truss_length", "Truss length", "mm"),
    sel("speed", "Speed", ["0.5 m/s", "0.65 m/s", "0.75 m/s"]),
    sel("environment", "Environment", ["Indoor", "Outdoor", "Semi-outdoor"]),
  ],
};

const ESC_MACHINE: PassportSection = {
  key: "machine_drive",
  title: "Drive machine, motor & brakes",
  fields: [
    sel("drive_location", "Drive location", ["Upper truss", "Lower truss", "Intermediate"]),
    sel("motor_brand", "Motor brand", ["ABB", "Siemens", "SEW", "WEG", "Manufacturer standard"]),
    num("motor_kw", "Motor power", "kW"),
    sel("drive_kind", "Drive type", ["Direct coupled", "Geared", "Chain driven"]),
    sel("main_brake", "Main brake", ["Disc", "Drum", "Band"]),
    sel("aux_brake", "Auxiliary brake", ["Fitted", "N/A"]),
    sel("gearbox_oil", "Gearbox oil", ["ISO VG 220", "ISO VG 320", "N/A — direct drive"]),
  ],
};

const ESC_STEPS: PassportSection = {
  key: "escalator_steps_chains",
  title: "Steps, pallets & drive chains",
  fields: [
    sel("step_width", "Step / pallet width", ["600 mm", "800 mm", "1000 mm"]),
    sel("step_material", "Step material", ["Aluminium", "Steel"]),
    num("step_count", "Step / pallet count"),
    sel("chain_type", "Step chain type", ["Roller chain", "Step band"]),
    sel("lubrication", "Chain lubrication", ["Automatic oiler", "Manual", "N/A"]),
    sel("comb_plates", "Comb plates", ["Aluminium", "Yellow plastic", "Steel"]),
  ],
};

const ESC_HANDRAIL: PassportSection = {
  key: "escalator_handrail_balustrade",
  title: "Handrail, drive & balustrades",
  fields: [
    sel("handrail_brand", "Handrail brand", ["Semperit", "EHC", "KDS", "Manufacturer standard"]),
    sel("handrail_profile", "Handrail profile", ["C-profile", "V-profile"]),
    sel("handrail_colour", "Handrail colour", ["Black", "Grey", "Blue", "Red"]),
    sel("handrail_drive", "Handrail drive", ["Friction drive", "V-belt", "Direct"]),
    sel("handrail_speed_sensor", "Handrail speed sensor", ["Fitted", "N/A"]),
    sel("balustrade_type", "Balustrade type", ["Glass", "Stainless steel"]),
    num("balustrade_height", "Balustrade height", "mm"),
    sel("skirt_brushes", "Skirt brushes", ["Fitted", "N/A"]),
    sel("safety_switches", "Safety switch set", ["Complete", "Partial — list in notes"]),
  ],
};

const ESC_CONTROLLER: PassportSection = {
  key: "controller_electronics",
  title: "Controller & inverter",
  fields: [
    sel("controller", "Controller", ["Manufacturer standard", "Arkel", "KEB", "Siemens PLC"]),
    sel("operation_mode", "Operation mode", ["Continuous", "Auto-start (passenger detection)", "VFD eco mode"]),
    sel("vfd", "Variable frequency drive", ["Fitted", "N/A"]),
    sel("step_lighting", "Step demarcation lighting", ["Fitted", "N/A"]),
    sel("comb_lighting", "Comb plate lighting", ["Fitted", "N/A"]),
  ],
};

export const LIFT_SECTIONS: PassportSection[] = [LIFT_GENERAL, LIFT_MACHINE, LIFT_SUSPENSION, LIFT_CONTROLLER, LIFT_DOORS];
export const ESCALATOR_SECTIONS: PassportSection[] = [ESC_GENERAL, ESC_MACHINE, ESC_STEPS, ESC_HANDRAIL, ESC_CONTROLLER];

export const DRIVE_TYPES: { value: DriveType; label: string }[] = [
  { value: "traction", label: "Traction" },
  { value: "hydraulic", label: "Hydraulic" },
  { value: "screw", label: "Screw & nut" },
  { value: "na", label: "N/A" },
];

/** Sections visible for an equipment type. */
export function sectionsFor(equipmentType: PassportEquipmentType): PassportSection[] {
  return equipmentType === "lift" ? LIFT_SECTIONS : ESCALATOR_SECTIONS;
}

/** Fields of a section visible for the chosen drive type (lift machine/drive splits traction vs hydraulic). */
export function fieldsFor(section: PassportSection, driveType: DriveType): PassportField[] {
  return section.fields.filter((f) => !f.drives || f.drives.includes(driveType));
}

export type PassportBlocks = Record<string, Record<string, string>>;

/** Coerces a DB row's jsonb blocks into editable string maps. */
export function normalizeBlocks(row: Record<string, unknown> | null | undefined): PassportBlocks {
  const out: PassportBlocks = {};
  for (const key of ["general", "machine_drive", "suspension_safety", "controller_electronics", "doors_cabin", "escalator_geometry", "escalator_steps_chains", "escalator_handrail_balustrade"]) {
    const block = row?.[key];
    out[key] = {};
    if (block && typeof block === "object" && !Array.isArray(block)) {
      for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
        if (v != null && v !== "") { const target = out[key]; if (target) target[k] = String(v); }
      }
    }
  }
  return out;
}

/** Learns suggestion values per field key from the company's other passports. */
export function learnFromPassports(rows: Record<string, unknown>[]): Record<string, string[]> {
  const learned: Record<string, string[]> = {};
  for (const row of rows) {
    for (const block of Object.values(normalizeBlocks(row))) {
      for (const [k, v] of Object.entries(block)) {
        if (!v || v === NA) continue;
        const list = (learned[k] ??= []);
        if (!list.includes(v)) list.push(v);
      }
    }
  }
  return learned;
}

/** Merges built-in options with learned values, built-ins first, no duplicates. */
export function fieldOptions(field: PassportField, learned: Record<string, string[]>): string[] {
  const base = field.options ?? [];
  const extra = (learned[field.key] ?? []).filter((v) => !base.includes(v));
  return [...base, ...extra];
}

/** Guesses equipment type from a core asset category label. */
export function equipmentTypeForCategory(category: string | null | undefined): PassportEquipmentType {
  const c = (category ?? "").toLowerCase();
  if (c.includes("escalator")) return "escalator";
  if (c.includes("walk")) return "moving_walk";
  return "lift";
}

export type PassportAsset = { reference_number: string; serial_number: string | null; location_details: string | null };
export function assetPassportBlocks(asset: PassportAsset | undefined, category: string | null, row: Record<string, unknown> | null | undefined): PassportBlocks {
  const blocks = normalizeBlocks(row);
  if (row || !asset) return blocks;
  blocks['general'] = { [equipmentTypeForCategory(category) === 'lift' ? 'lift_ref' : 'escalator_ref']: asset.reference_number, serial_number: asset.serial_number ?? '', location_details: asset.location_details ?? '' };
  return blocks;
}
