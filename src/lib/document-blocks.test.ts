import { describe, expect, it } from "vitest";
import { DEFAULT_COMMERCIAL, DEFAULT_SPEC, extrasFor, hasCommercial, parseCommercial, parseExtras, parseFieldSpecs, specShows } from "./document-blocks";

describe("parseFieldSpecs", () => {
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
