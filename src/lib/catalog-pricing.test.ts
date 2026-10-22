import { describe, expect, it } from "vitest";
import { priceForCadence, cadenceSuffix } from "./catalog-pricing";

describe("priceForCadence", () => {
  it("uses the catalogue's saved prices when present", () => {
    const item = { monthly_price: 89, quarterly_price: 240.3, yearly_price: 854.4 };
    expect(priceForCadence(item, "monthly")).toBe(89);
    expect(priceForCadence(item, "quarterly")).toBe(240.3);
    expect(priceForCadence(item, "yearly")).toBe(854.4);
  });
  it("derives quarterly at 10% off and yearly at 20% off when only monthly is set", () => {
    const item = { monthly_price: 89, quarterly_price: null, yearly_price: null };
    expect(priceForCadence(item, "quarterly")).toBe(240.3);
    expect(priceForCadence(item, "yearly")).toBe(854.4);
  });
  it("returns null when no price exists", () => {
    expect(priceForCadence({ monthly_price: null, quarterly_price: null, yearly_price: null }, "monthly")).toBeNull();
  });
});

describe("cadenceSuffix", () => {
  it("labels each cadence", () => {
    expect(cadenceSuffix("monthly")).toBe("/mo");
    expect(cadenceSuffix("quarterly")).toBe("/qtr");
    expect(cadenceSuffix("yearly")).toBe("/yr");
  });
});
