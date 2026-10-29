import { describe, expect, it } from "vitest";
import { retailRoi } from "./retail-roi";
import type { PublicCatalogItem } from "./public-catalog.functions";
const plan: PublicCatalogItem = { id: "pro", name: "Multi-Store Pro", kind: "plan", sort_order: 2, monthly_price: 249, quarterly_price: 709.65, yearly_price: 2539.8, included_seats: 12, storage_gb: 50, billing_basis: "company", modules: [] };
const input = { technicians: 10, stores: 3, days: 21, minutes: 45, hourlyRate: 18, comparisonPerSeat: null, setupCost: 0 };
describe("retail ROI", () => {
  it("uses the sample 10 × 45 minutes × 21 days × €18 calculation, not a guarantee", () => {
    const r = retailRoi(input, plan, "monthly");
    expect(r.hours).toBe(157.5); expect(r.annualCapacity).toBe(34020); expect(r.net).toBe(31032);
  });
  it("uses the approved €249 monthly catalog price", () => { expect(retailRoi(input, plan, "monthly").annualCost).toBe(2988); });
  it("uses saved annual prices without mixing monthly and yearly billing", () => { expect(retailRoi(input, plan, "yearly").annualCost).toBe(2539.8); });
  it("compares only a customer-entered euro quote", () => {
    expect(retailRoi(input, plan, "monthly").licenceDifference).toBeNull();
    expect(retailRoi({ ...input, technicians: 12, comparisonPerSeat: 60 }, plan, "monthly").licenceDifference).toBe(5652);
  });
  it("does not multiply technician capacity by store count", () => { expect(retailRoi({ ...input, stores: 20 }, plan, "monthly").hours).toBe(157.5); });
  it("does not claim savings for more than 12 included seats", () => { expect(retailRoi({ ...input, technicians: 13 }, plan, "monthly").fits).toBe(false); });
  it("shows negative returns when no time is recovered and includes setup cost", () => { expect(retailRoi({ ...input, minutes: 0, setupCost: 1000 }, plan, "monthly").net).toBe(-3988); });
});