import { describe, expect, it } from "vitest";
import { DEFAULT_TRIAL_DAYS, monthlyEquivalent, trialAccess, costPerUser, estimatePhotoStorage, effectiveModules } from "./platform";
describe("configurable commercial controls", () => {
  it("defaults to a 60-day no-card trial", () => expect(DEFAULT_TRIAL_DAYS).toBe(60));
  it("quarterly prices cover three months", () => expect(monthlyEquivalent(300, "quarterly")).toBe(100));
  it("yearly prices cover twelve months", () => expect(monthlyEquivalent(1200, "yearly")).toBe(100));
  it("trial writes end at expiry", () => { expect(trialAccess("2026-10-18T00:00:00Z", Date.parse("2026-10-17T23:59:59Z"))).toBe(true); expect(trialAccess("2026-10-18T00:00:00Z", Date.parse("2026-10-18T00:00:00Z"))).toBe(false); });
  it("packs unlock modules without changing seats", () => expect(effectiveModules(["contracts"], [["payroll"]], [], 0)).toContain("payroll"));
  it("promotional modules expire after the specified month", () => { const o = [{ module: "payroll", enabled: true, starts_at: "2026-10-01", ends_at: "2026-11-01" }]; expect(effectiveModules([], [], o, Date.parse("2026-10-18"))).toContain("payroll"); expect(effectiveModules([], [], o, Date.parse("2026-11-01"))).not.toContain("payroll"); });
  it("calculates expenses per paid seat, not per company", () => { expect(costPerUser(80, 8)).toBe(10); expect(costPerUser(80, 0)).toBeNull(); });
  it("models four photos per sheet", () => expect(estimatePhotoStorage(66)).toBeCloseTo(316.8));
});