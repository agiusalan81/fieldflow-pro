/**
 * Product editions running on the shared FieldBridge engine.
 * HQ product (platform_products.engine_edition) decides the edition; the UI only re-skins
 * and re-words. Entitlements stay in the database.
 */
export type Edition = "contractor" | "hotel" | "retail";

export const EDITIONS: Edition[] = ["contractor", "hotel", "retail"];

export function parseEdition(v: unknown): Edition {
  return v === "hotel" || v === "retail" ? v : "contractor";
}

type EditionSpec = {
  product: string;
  tagline: string;
  /** Public web address for the product's own site. */
  home: string;
  /** Contractor-only screens hidden in in-house editions (navigation only). */
  hiddenRoutes: string[];
  /** Menu label renames (exact match). */
  labels: Record<string, string>;
  siteTypes: string[];
  assetGroups: { group: string; items: string[] }[];
};

const CONTRACTOR_ONLY = ["/crm", "/estimates", "/proposals", "/lift-surveys", "/lift-costing", "/lift-rfq", "/as-built", "/surveys"];

export const EDITION_SPEC: Record<Edition, EditionSpec> = {
  contractor: { product: "FieldBridge", tagline: "Field service management", home: "/", hiddenRoutes: [], labels: {}, siteTypes: [], assetGroups: [] },
  hotel: {
    product: "FieldBridge Hotels",
    tagline: "In-house hotel engineering",
    home: "/hotels",
    hiddenRoutes: CONTRACTOR_ONLY,
    labels: {
      "Clients & assets": "Properties, rooms & assets",
      "Job sheets": "Work orders",
      "My job sheets": "My work orders",
      "QR code generator": "Room QR codes",
      "Contracts": "Supplier contracts",
      "Dispatched jobs": "Assigned work orders",
      "Pending Works": "Open defects",
      "Pending works": "Open defects",
      "Overview": "Engineering overview",
      "Today & team": "Today's shift",
    },
    siteTypes: ["Hotel building / wing", "Guest floor", "Guest room", "Suite", "Restaurant & bar", "Kitchen", "Laundry", "Spa & pool", "Conference & events", "Back of house", "Plant room", "Car park", "Grounds & gardens"],
    assetGroups: [
      { group: "Guest room", items: ["Air conditioning unit", "Fan coil", "TV", "Minibar", "Safe", "Door lock / key card", "Shower & taps", "WC & cistern", "Lighting", "Curtains & blinds", "Furniture"] },
      { group: "Building fabric", items: ["Floor tiles", "Wall tiles", "Walls & paint", "Ceilings", "Doors & frames", "Windows & glazing", "Balconies & railings", "Waterproofing"] },
      { group: "Plant & services", items: ["Chiller", "Boiler / calorifier", "Hot water system", "Water pumps", "Generator", "Electrical distribution board", "Fire alarm panel", "Lifts", "Pool pumps & filtration"] },
      { group: "Kitchen & laundry", items: ["Cold room", "Freezer", "Combi oven", "Dishwasher", "Extraction hood", "Washer", "Dryer", "Ironer"] },
      { group: "Outdoor & parking", items: ["Car park barrier", "Car park lighting", "Paving & road markings", "Drainage", "Irrigation", "Signage"] },
    ],
  },
  retail: {
    product: "AisleOps",
    tagline: "In-house store maintenance",
    home: "/retail",
    hiddenRoutes: CONTRACTOR_ONLY,
    labels: {
      "Clients & assets": "Stores, sites & equipment",
      "Job sheets": "Maintenance tickets",
      "My job sheets": "My tickets",
      "QR code generator": "Equipment QR codes",
      "Contracts": "Supplier contracts",
      "Dispatched jobs": "Assigned tickets",
      "Pending Works": "Open faults",
      "Pending works": "Open faults",
      "Overview": "Estate overview",
      "Today & team": "Today's rounds",
    },
    siteTypes: ["Superstore", "Express outlet", "Bakery", "Pastry kitchen", "Production / factory", "Warehouse & distribution", "Head office", "Car park"],
    assetGroups: [
      { group: "Refrigeration", items: ["Multideck chiller", "Freezer island", "Cold room", "Freezer room", "Condensing unit", "Refrigeration rack"] },
      { group: "Bakery & production", items: ["Deck oven", "Rack oven", "Proofer", "Dough mixer", "Divider / rounder", "Slicer", "Production line", "Packing machine"] },
      { group: "Building fabric", items: ["Floor tiles", "Wall tiles", "Walls & paint", "Ceilings", "Roof & gutters", "Automatic doors", "Shutters", "Toilets & washrooms"] },
      { group: "Store equipment", items: ["Checkout / POS", "Scales", "Shelving & racking", "Trolley bay", "Lighting", "Signage", "Security gates / CCTV"] },
      { group: "Plant & services", items: ["Air conditioning / AHU", "Generator", "Electrical distribution board", "Fire alarm panel", "Sprinklers", "Water pumps"] },
      { group: "Outdoor & parking", items: ["Car park barrier", "Car park lighting", "Paving & potholes", "Road markings", "Drainage", "Loading bay / dock leveller"] },
    ],
  },
};

/** Rename and filter a menu for an edition. Navigation only; access is enforced server-side. */
export function editionMenu<T extends { to: string; label: string }>(edition: Edition, items: T[]): T[] {
  const spec = EDITION_SPEC[edition];
  return items.filter((i) => !spec.hiddenRoutes.includes(i.to)).map((i) => ({ ...i, label: spec.labels[i.label] ?? i.label }));
}

export function editionLabel(edition: Edition, label: string) {
  return EDITION_SPEC[edition].labels[label] ?? label;
}

/** In-house editions (hotel/retail) have no external clients, leads or sales pipeline. */
export function isInHouse(edition: Edition) {
  return edition !== "contractor";
}

/** Equipment type choices for the edition; contractor keeps the lift-first list. */
export function editionEquipmentTypes(edition: Edition, contractorTypes: string[]): string[] {
  if (!isInHouse(edition)) return contractorTypes;
  return [...EDITION_SPEC[edition].assetGroups.flatMap((g) => g.items), "Other"];
}
