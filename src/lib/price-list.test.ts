import { describe, it, expect } from "vitest";
import { lineTotal, missingStarter, starterFor } from "./price-list";

describe("price list", () => {
  it("5 Ts at €10 make a €50 line", () => expect(lineTotal(5, 10, 0).net).toBe(50));
  it("adds 18% VAT", () => expect(lineTotal(5, 10, 18)).toEqual({ net: 50, vat: 9, total: 59 }));
  it("drain fittings are tally items", () => expect(starterFor("drains").filter((i) => i.category === "Fittings").every((i) => i.is_tally)).toBe(true));
  it("does not re-import items the company already has", () => {
    const all = starterFor("drains");
    const left = missingStarter("drains", [{ trade: "drains", category: "Fittings", name: "y junction" }]);
    expect(left.length).toBe(all.length - 1);
  });
});

import { operatingTrades, defaultTrade } from "./price-list";
describe("operating trades", () => {
  it("offers only ticked trades plus custom", () => {
    expect(operatingTrades(["electrical", "plumbing", "drains"]).map((t) => t.key)).toEqual(["electrical", "plumbing", "drains", "custom"]);
  });
  it("offers every trade when none ticked", () => { expect(operatingTrades([]).length).toBe(8); });
  it("opens on the main industry's trade", () => {
    expect(defaultTrade(operatingTrades(["electrical", "plumbing", "drains"]), "plumbing")).toBe("plumbing");
    expect(defaultTrade(operatingTrades(["plumbing", "drains"]), "electrical")).toBe("plumbing");
  });
});
