import { describe, expect, it } from "vitest";
import { featureOn } from "./plan-features";

describe("Platform HQ feature switches", () => {
  it("Fleet Management can be disabled independently of live tracking", () => { const status = { state: "active", modules: [{ name: "fleet_management", enabled: false }, { name: "tracking", enabled: true }] }; expect(featureOn(status,"fleet_management")).toBe(false); expect(featureOn(status,"tracking")).toBe(true); });
  it("companies without a plan keep every feature", () => expect(featureOn({ state: "legacy" }, "payroll")).toBe(true));
  it("a switched-off feature is hidden", () => expect(featureOn({ state: "active", modules: [{ name: "payroll", enabled: false }] }, "payroll")).toBe(false));
  it("a feature the product does not list stays on", () => expect(featureOn({ state: "active", modules: [] }, "standby")).toBe(true));
});
