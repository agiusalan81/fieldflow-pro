import { describe, expect, it } from "vitest";
import { cadencePrices, cadenceDiscounts } from "./platform";
describe("cadence discounts", () => {
  it("monthly is the undiscounted year / 12", () => expect(cadencePrices(1200, 5, 15).monthly_price).toBe(100));
  it("quarterly applies its discount to the year then / 4", () => expect(cadencePrices(1200, 5, 15).quarterly_price).toBe(285));
  it("yearly applies its discount", () => expect(cadencePrices(1200, 5, 15).yearly_price).toBe(1020));
  it("recovers discounts from saved prices", () => expect(cadenceDiscounts({ monthly_price: 100, quarterly_price: 285, yearly_price: 1020 })).toEqual({ fullYear: 1200, quarterlyDiscount: 5, yearlyDiscount: 15 }));
});
