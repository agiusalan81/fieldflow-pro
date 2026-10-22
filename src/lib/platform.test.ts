import { describe, expect, it } from "vitest";
import { COMPANY_PRODUCT_KEY, companyProduct, productLink, DEFAULT_TRIAL_DAYS, monthlyEquivalent, trialAccess, costPerUser, estimatePhotoStorage, effectiveModules } from "./platform";
describe("configurable commercial controls", () => {
  it("uses the renamed fieldbridge product key", () => expect(COMPANY_PRODUCT_KEY).toBe("fieldbridge"));
  it("prefers FieldBridge over another active product", () => expect(companyProduct([{ slug: "other", active: true }, { slug: "fieldbridge", active: true }])?.slug).toBe("fieldbridge"));
  it("falls back only to a single active product", () => { expect(companyProduct([{ slug: "other", active: true }])?.slug).toBe("other"); expect(companyProduct([{ slug: "one", active: true }, { slug: "two", active: true }])).toBeNull(); });
  it("builds company registration links on the configured application URL", () => expect(productLink("https://fieldbridgeapp.com/", "/auth?mode=signup")).toBe("https://fieldbridgeapp.com/auth?mode=signup"));
  it("builds referral links on the configured application URL", () => expect(productLink("https://fieldbridgeapp.com/", "/referral/abc")).toBe("https://fieldbridgeapp.com/referral/abc"));
  it("defaults to a 60-day no-card trial", () => expect(DEFAULT_TRIAL_DAYS).toBe(60));
  it("quarterly prices cover three months", () => expect(monthlyEquivalent(300, "quarterly")).toBe(100));
  it("yearly prices cover twelve months", () => expect(monthlyEquivalent(1200, "yearly")).toBe(100));
  it("trial writes end at expiry", () => { expect(trialAccess("2026-10-18T00:00:00Z", Date.parse("2026-10-17T23:59:59Z"))).toBe(true); expect(trialAccess("2026-10-18T00:00:00Z", Date.parse("2026-10-18T00:00:00Z"))).toBe(false); });
  it("packs unlock modules without changing seats", () => expect(effectiveModules(["contracts"], [["payroll"]], [], 0)).toContain("payroll"));
  it("promotional modules expire after the specified month", () => { const o = [{ module: "payroll", enabled: true, starts_at: "2026-10-01", ends_at: "2026-11-01" }]; expect(effectiveModules([], [], o, Date.parse("2026-10-18"))).toContain("payroll"); expect(effectiveModules([], [], o, Date.parse("2026-11-01"))).not.toContain("payroll"); });
  it("calculates expenses per paid seat, not per company", () => { expect(costPerUser(80, 8)).toBe(10); expect(costPerUser(80, 0)).toBeNull(); });
  it("models four photos per sheet", () => expect(estimatePhotoStorage(66)).toBeCloseTo(316.8));
});import { packagePrice } from "./platform";
describe("package billing basis", () => {
  it("per-company items charge once", () => expect(packagePrice([{ price: 50, billing_basis: "company" }], 6)).toBe(50));
  it("per-user items charge for every user", () => expect(packagePrice([{ price: 5, billing_basis: "per_user" }], 6)).toBe(30));
  it("mixes tier and packs", () => expect(packagePrice([{ price: 100, billing_basis: "company" }, { price: 4, billing_basis: "per_user" }], 10)).toBe(140));
});
