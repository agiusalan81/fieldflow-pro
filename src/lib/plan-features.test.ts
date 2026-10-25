import { describe, expect, it } from "vitest";
import { featureOn, resolveAppTitle } from "./plan-features";

describe("Platform HQ feature switches", () => {
  it("customer quoting inherits Core rather than supplier or QS access", () => {
    const status = { state: "active", modules: [{ name: "core", enabled: true }, { name: "customer_quotes", enabled: false }, { name: "estimates", enabled: false }, { name: "qs_pricing", enabled: false }] };
    expect(featureOn(status, "customer_quotes")).toBe(true);
    expect(featureOn({ ...status, modules: [{ name: "core", enabled: false }] }, "customer_quotes")).toBe(false);
  });
  it("keeps standby enabled when payroll is disabled", () => {
    const status = { state: "active", modules: [{ name: "standby", enabled: true }, { name: "payroll", enabled: false }] };
    expect(featureOn(status, "standby")).toBe(true);
    expect(featureOn(status, "payroll")).toBe(false);
  });
  it("keeps payroll enabled when standby is disabled", () => {
    const status = { state: "active", modules: [{ name: "standby", enabled: false }, { name: "payroll", enabled: true }] };
    expect(featureOn(status, "standby")).toBe(false);
    expect(featureOn(status, "payroll")).toBe(true);
  });
  it("Fleet Management can be disabled independently of live tracking", () => { const status = { state: "active", modules: [{ name: "fleet_management", enabled: false }, { name: "tracking", enabled: true }] }; expect(featureOn(status,"fleet_management")).toBe(false); expect(featureOn(status,"tracking")).toBe(true); });
  it("companies without a plan keep every feature", () => expect(featureOn({ state: "legacy" }, "payroll")).toBe(true));
  it("a switched-off feature is hidden", () => expect(featureOn({ state: "active", modules: [{ name: "payroll", enabled: false }] }, "payroll")).toBe(false));
  it("a feature the product does not list stays on", () => expect(featureOn({ state: "active", modules: [] }, "standby")).toBe(true));
});

describe("app title", () => {
  it("defaults to FieldBridge", () => expect(resolveAppTitle("", true)).toBe("FieldBridge"));
  it("uses the company's title when the plan allows it", () => expect(resolveAppTitle("Acme Lifts", true)).toBe("Acme Lifts"));
  it("stays FieldBridge when the plan does not include it", () => expect(resolveAppTitle("Acme Lifts", false)).toBe("FieldBridge"));
});
