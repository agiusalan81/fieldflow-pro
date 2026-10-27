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

describe("tier values", () => {
  it("round-trips per-tier visits, prices and discounts", () => {
    const c = parseCommercial({ tierValues: [{ tierId: "t1", name: "Gold", visitsPerYear: 4, basePrice: 900, labourDiscountPct: 10, partsDiscountPct: 5 }] });
    expect(c.tierValues).toEqual([{ tierId: "t1", name: "Gold", visitsPerYear: 4, basePrice: 900, labourDiscountPct: 10, partsDiscountPct: 5 }]);
    expect(parseCommercial(JSON.parse(JSON.stringify(c))).tierValues).toEqual(c.tierValues);
  });
  it("drops entries without a tier and clamps bad numbers", () => {
    const c = parseCommercial({ tierValues: [{ name: "No id" }, { tierId: "t2", name: "Silver", visitsPerYear: -2, basePrice: "450", labourDiscountPct: 140 }] });
    expect(c.tierValues).toHaveLength(1);
    expect(c.tierValues[0]).toEqual({ tierId: "t2", name: "Silver", visitsPerYear: null, basePrice: 450, labourDiscountPct: 100, partsDiscountPct: 0 });
  });
  it("counts as commercial content and defaults to empty", () => {
    expect(parseCommercial(undefined).tierValues).toEqual([]);
    expect(hasCommercial(parseCommercial({ tierValues: [{ tierId: "t1", name: "Gold" }] }))).toBe(true);
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

import { audienceCopyRows, resolveChecklistValue, stepPrice } from "./document-blocks";
import { parseRich, stripRich, wrapSelection } from "./rich-text";
describe("checklist copies and reports", () => {
  it("unanswered steps report as N/A", () => {
    expect(resolveChecklistValue(undefined)).toBe("N/A");
    expect(resolveChecklistValue("")).toBe("N/A");
    expect(resolveChecklistValue(false)).toBe("N/A");
    expect(resolveChecklistValue("Pass")).toBe("Pass");
  });
  it("client step price prints only when positive", () => {
    expect(stepPrice({ ...DEFAULT_SPEC, price: 45 })).toBe("€45.00");
    expect(stepPrice(DEFAULT_SPEC)).toBeNull();
    expect(parseFieldSpecs([{ price: -3, photo: "yes" }], 1)[0]).toEqual(DEFAULT_SPEC);
  });
  it("technician copy drops client-only rows", () => {
    const r = audienceCopyRows(["A", "B"], [{ audience: "client" }, { audience: "both", photo: true }], "technician");
    expect(r.items).toEqual(["B"]);
    expect(r.specs[0]?.photo).toBe(true);
  });
  it("formatting markers parse and strip", () => {
    expect(parseRich("**Brake** [red]critical[/red]")).toEqual([{ text: "Brake", bold: true }, { text: " " }, { text: "critical", color: "red" }]);
    expect(stripRich("__Doors__ *ok*")).toBe("Doors ok");
    expect(wrapSelection("abc", 1, 2, "**").text).toBe("a**b**c");
  });
  it("wrapping never splits an existing colour marker", () => {
    const coloured = wrapSelection("check [red]brakes[/red] now", 6, 21, "**");
    expect(coloured.text).toBe("check **[red]brakes[/red]** now");
    expect(stripRich(coloured.text)).toBe("check brakes now");
    expect(parseRich(coloured.text)).toEqual([{ text: "check " }, { text: "brakes", bold: true, color: "red" }, { text: " now" }]);
  });
  it("a selection starting inside a marker expands outward instead of breaking it", () => {
    const r = wrapSelection("a [red]hot[/red] b", 5, 8, "**");
    expect(r.text).toBe("a **[red]hot[/red]** b");
    expect(parseRich(r.text).some((s) => s.text.includes("[red]"))).toBe(false);
  });
  it("applying the same marker again unwraps instead of double-wrapping", () => {
    const once = wrapSelection("hello world", 6, 11, "**");
    expect(once.text).toBe("hello **world**");
    const twice = wrapSelection(once.text, 8, 13, "**");
    expect(twice.text).toBe("hello world");
  });
  it("colour then bold on the same words stays valid markup", () => {
    const red = wrapSelection("Oil leak", 0, 8, "[red]", "[/red]");
    const both = wrapSelection(red.text, 0, red.text.length, "**");
    expect(stripRich(both.text)).toBe("Oil leak");
    expect(parseRich(both.text)).toEqual([{ text: "Oil leak", bold: true, color: "red" }]);
  });
});
