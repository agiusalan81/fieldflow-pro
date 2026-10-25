import { describe, expect, it } from "vitest";
import { DEFAULT_COMMERCIAL, DEFAULT_SPEC, DEFAULT_LIFT_PRICING, checklistRows, moveChecklistRow, commercialPriceLines, commercialTotal, extrasFor, hasCommercial, parseCommercial, parseExtras, parseFieldSpecs, specShows } from "./document-blocks";

describe("parseFieldSpecs", () => {
  it("new rows default to both copies while saved technician-only rows stay private", () => {
    expect(checklistRows(["New step"], [])[0]?.spec.audience).toBe("both");
    expect(parseFieldSpecs([{ audience: "technician" }], 1)[0]?.audience).toBe("technician");
  });
  it("fills defaults so every item has a control", () => {
    const specs = parseFieldSpecs(undefined, 3);
    expect(specs).toHaveLength(3);
    expect(specs[0]).toEqual(DEFAULT_SPEC);
  });
  it("keeps valid stored values and drops junk", () => {
    const specs = parseFieldSpecs([{ control: "passfail", audience: "both", unit: "" }, { control: "weird", audience: "client" }], 3);
    expect(specs[0]).toEqual({ control: "passfail", audience: "both", unit: "" });
    expect(specs[1]).toEqual({ control: "checkbox", audience: "client", unit: "" });
    expect(specs[2]).toEqual(DEFAULT_SPEC);
  });
  it("visibility follows audience", () => {
    expect(specShows({ ...DEFAULT_SPEC, audience: "technician" }, "client")).toBe(false);
    expect(specShows({ ...DEFAULT_SPEC, audience: "both" }, "client")).toBe(true);
  });
});

describe("parseCommercial", () => {
  it("returns defaults for empty storage", () => {
    expect(parseCommercial(undefined)).toEqual(DEFAULT_COMMERCIAL);
  });
  it("retains the optional client sample calculation without changing its total", () => {
    const c = parseCommercial({ basePrice: 500, showSampleCalculation: true, liftPricing: { ...DEFAULT_LIFT_PRICING, stops: 6, landingDoors: 4, carAccess: 2, extraStopRate: 25, landingDoorRate: 30, extraCarDoorRate: 45 } });
    expect(parseCommercial(JSON.parse(JSON.stringify(c))).showSampleCalculation).toBe(true);
    expect(commercialTotal(c)).toBe(765);
  });
  it("rejects negative or non-numeric money and clamps discounts", () => {
    const c = parseCommercial({ basePrice: -5, visitsPerYear: "12", labourDiscountPct: 140, partsDiscountPct: -3, billingCycle: "weekly" });
    expect(c.basePrice).toBeNull();
    expect(c.visitsPerYear).toBe(12);
    expect(c.labourDiscountPct).toBe(100);
    expect(c.partsDiscountPct).toBe(0);
    expect(c.billingCycle).toBe("annually");
  });
  it("hasCommercial is false for an empty unpriced block", () => {
    expect(hasCommercial(parseCommercial(undefined))).toBe(false);
    expect(hasCommercial(parseCommercial({ terms: "  " }))).toBe(false);
    expect(hasCommercial(parseCommercial({ basePrice: 480 }))).toBe(true);
  });
});

describe("parseExtras", () => {
  it("drops empty entries and filters by audience", () => {
    const extras = parseExtras([{ label: "SLA", value: "4h", audience: "client" }, { label: "", value: "" }, { label: "Oil", value: "ISO 32" }]);
    expect(extras).toHaveLength(2);
    expect(extrasFor(extras, "client").map((e) => e.label)).toEqual(["SLA", "Oil"]);
    expect(extrasFor(extras, "technician").map((e) => e.label)).toEqual(["Oil"]);
  });
});

describe("lift pricing", () => {
  const quote = (overrides: Record<string, unknown> = {}) => parseCommercial({ basePrice: 500, liftPricing: { ...DEFAULT_LIFT_PRICING, extraStopRate: 25, landingDoorRate: 30, extraCarDoorRate: 45, ...overrides } });
  it("includes two stops in the base and charges each extra stop", () => {
    expect(commercialPriceLines(quote({ stops: 6 })).find(l => l.key === "stops")?.amount).toBe(100);
    expect(commercialPriceLines(quote({ stops: 1 })).find(l => l.key === "stops")?.amount).toBe(0);
  });
  it("prices six travel stops with only two landing doors independently", () => {
    expect(commercialTotal(quote({ stops: 6, landingDoors: 2 }))).toBe(660);
  });
  it("allows multiple landing doors per floor", () => {
    expect(commercialPriceLines(quote({ stops: 2, landingDoors: 6 })).find(l => l.key === "landing")?.amount).toBe(180);
  });
  it("2 car access adds one cabin door", () => {
    expect(commercialPriceLines(quote({ carAccess: 2 })).find(l => l.key === "car")?.amount).toBe(45);
  });
  it("3 car access adds two cabin doors", () => {
    expect(commercialPriceLines(quote({ carAccess: 3 })).find(l => l.key === "car")?.amount).toBe(90);
  });
  it("client display choice does not change the price", () => {
    const c = quote({ stops: 6, landingDoors: 4, carAccess: 2 });
    expect(commercialTotal(c)).toBe(765);
    expect(commercialTotal({ ...c, clientPriceDisplay: "itemised" })).toBe(765);
  });
  it("retains lift settings through a stored JSON roundtrip", () => {
    const c = { ...quote({ carAccess: 3 }), clientPriceDisplay: "itemised" };
    expect(parseCommercial(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
});

describe("checklist row identity", () => {
  it("moves controls and visibility with their descriptions", () => {
    const rows = checklistRows(["Locks", "Pressure"], [DEFAULT_SPEC, { control: "reading", audience: "both", unit: "bar" }]);
    const moved = moveChecklistRow(rows, 1, 0);
    expect(moved[0]).toEqual({ item: "Pressure", spec: { control: "reading", audience: "both", unit: "bar" } });
    expect(moved.filter((_, i) => i !== 1)).toEqual([rows[1]]);
  });
});
