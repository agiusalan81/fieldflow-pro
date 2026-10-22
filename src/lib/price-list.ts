/** Trade-neutral price list (qs_pricing module): trades, units, starter catalogues and line totals. */
export const TRADES = [
  { key: "elevator", label: "Elevator & Escalator" },
  { key: "electrical", label: "Electrical" },
  { key: "plumbing", label: "Plumbing" },
  { key: "drains", label: "Drains" },
  { key: "mechanical", label: "Mechanical" },
  { key: "fire_security", label: "Fire & Security" },
  { key: "hvac", label: "HVAC & Refrigeration" },
  { key: "custom", label: "Other / custom" },
] as const;
export type TradeKey = (typeof TRADES)[number]["key"];
/** Trades a company offers: its ticked operating trades plus Other / custom; every trade when none are ticked. */
export function operatingTrades(selected: readonly string[]) {
  const chosen = TRADES.filter((t) => t.key === "custom" || selected.includes(t.key));
  return chosen.length > 1 ? chosen : [...TRADES];
}
const PRESET_TRADE: Record<string, TradeKey> = { lifts: "elevator", hvac: "hvac", electrical: "electrical", plumbing: "plumbing", drains: "drains" };
/** Opens on the main industry's trade when offered, else the first offered trade. */
export function defaultTrade(options: readonly { key: TradeKey }[], mainIndustry?: string): TradeKey {
  const main = mainIndustry ? PRESET_TRADE[mainIndustry] : undefined;
  return main && options.some((o) => o.key === main) ? main : options[0]?.key ?? "custom";
}
export const UNITS = ["each", "point", "m", "ft", "m²", "hour", "day", "set", "lump sum"] as const;

export type StarterItem = { trade: TradeKey; category: string; name: string; unit: string; is_tally?: boolean };

const rows = (trade: TradeKey, category: string, unit: string, names: string[], is_tally = false): StarterItem[] =>
  names.map((name) => ({ trade, category, name, unit, is_tally }));

/** Starter items carry no prices: each company enters its own rates. */
export const STARTER_CATALOGUE: StarterItem[] = [
  ...rows("elevator", "Equipment", "each", ["Passenger lift — electric MR", "Passenger lift — electric MRL", "Passenger lift — hydraulic", "Home lift", "Goods lift — 4 post", "Goods lift — scissor", "Escalator"]),
  ...rows("elevator", "Modernisation", "each", ["Controller replacement", "Door operator replacement", "Machine / drive replacement", "COP replacement", "LOP replacement", "Car interior refurbishment"]),
  ...rows("elevator", "Builder's works & extras", "each", ["Crane hire", "Dismantle existing lift", "Scaffolding in shaft"]),
  ...rows("electrical", "Lighting", "point", ["Lighting point", "Emergency light point", "Outdoor light point"], true),
  ...rows("electrical", "Switches", "point", ["One-way switch", "Two-way switch", "Intermediate switch", "Dimmer switch"], true),
  ...rows("electrical", "Power", "point", ["Single socket outlet", "Double socket outlet", "Fused spur", "USB socket outlet"], true),
  ...rows("electrical", "Heavy appliances", "point", ["Cooker unit", "Water heater point", "AC isolator point", "EV charger point"], true),
  ...rows("electrical", "Distribution", "each", ["Distribution board", "MCB", "RCBO", "RCD", "Surge protection device"]),
  ...rows("electrical", "Cable laying", "m", ["Cable 1.5 mm²", "Cable 2.5 mm²", "Cable 4 mm²", "Cable 6 mm²", "Cable 10 mm²", "Armoured cable"]),
  ...rows("plumbing", "Water points", "point", ["Tap water point", "Washing machine point", "Dishwasher point", "Toilet water point"], true),
  ...rows("plumbing", "Pipework", "m", ["Multilayer pipe", "PPR pipe", "Copper pipe"]),
  ...rows("plumbing", "Equipment", "each", ["Manifold", "Water heater", "Booster pump"]),
  ...rows("plumbing", "Sanitaryware installation", "each", ["Install shower drain", "Install shower tray", "Install shower cubicle", "Install shower glass", "Install wash hand basin", "Install toilet", "Install sink", "Install bath"], true),
  ...rows("drains", "Drain runs", "ft", ["40 mm drain", "50 mm drain", "110 mm drain"]),
  ...rows("drains", "Fittings", "each", ["Y junction", "T junction", "Elbow 45°", "Elbow 90°", "Gully trap", "Inspection chamber"], true),
  ...rows("mechanical", "Ventilation", "each", ["Ventilation fan", "Extractor hood", "Pump"], true),
  ...rows("mechanical", "Ducting & supports", "m", ["Ducting", "Cable tray", "Trunking / containment"]),
  ...rows("fire_security", "Fire alarm", "each", ["Fire alarm control panel", "Smoke detector", "Heat detector", "Manual call point", "Sounder / beacon", "Interface module"], true),
  ...rows("fire_security", "Fire suppression", "each", ["Fire extinguisher", "Hose reel", "Sprinkler head", "Fire pump"], true),
  ...rows("fire_security", "CCTV", "each", ["IP camera", "NVR recorder", "PoE switch", "Monitor"], true),
  ...rows("fire_security", "Intruder alarm", "each", ["Alarm panel", "PIR detector", "Door contact", "Keypad", "External siren"], true),
  ...rows("fire_security", "Access control & intercom", "each", ["Card reader", "Maglock / strike", "Exit button", "Video intercom station"], true),
  ...rows("fire_security", "Cabling & commissioning", "m", ["Fire-rated cable", "Cat6 cable"]),
  ...rows("fire_security", "Cabling & commissioning", "lump sum", ["Programming & commissioning", "Testing & handover"]),
  ...rows("hvac", "Air conditioning", "each", ["Split unit", "Multi-split outdoor unit", "VRF indoor unit", "VRF outdoor unit", "Ducted unit"]),
  ...rows("hvac", "Commercial cooling", "each", ["Chiller", "Air handling unit", "Fan coil unit"]),
  ...rows("hvac", "Refrigeration", "each", ["Condensing unit", "Evaporator", "Cold room panel set"]),
  ...rows("hvac", "Pipework & condensate", "m", ["Refrigerant pipe pair", "Condensate drain pipe", "Pipe insulation"]),
  ...rows("hvac", "Controls & commissioning", "each", ["Thermostat / controller", "Condensate pump", "Leak test & commissioning"]),
];

export function starterFor(trade: TradeKey): StarterItem[] { return STARTER_CATALOGUE.filter((i) => i.trade === trade); }

/** Starter items not already in the price list (same trade, category and name, case-insensitive). */
export function missingStarter(trade: TradeKey, existing: { trade: string; category: string; name: string }[]): StarterItem[] {
  const key = (i: { trade: string; category: string; name: string }) => `${i.trade}|${i.category}|${i.name}`.toLowerCase();
  const have = new Set(existing.map(key));
  return starterFor(trade).filter((i) => !have.has(key(i)));
}

/** Line totals rounded to cents; e.g. 5 × €10 at 18% VAT → 50 / 9 / 59. */
export function lineTotal(quantity: number, rate: number, vatRate: number) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const net = r(quantity * rate);
  const vat = r(net * vatRate / 100);
  return { net, vat, total: r(net + vat) };
}
