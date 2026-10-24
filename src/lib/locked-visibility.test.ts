import { describe, expect, it } from "vitest";
import { lockedVisibility } from "./plan-features";

describe("HQ locked module visibility", () => {
  it("hides every locked module when hide locked is on", () => {
    expect(lockedVisibility({ hide_locked_modules: true }, "payroll").hidden).toBe(true);
  });
  it("shows Coming soon modules even when hide locked is on", () => {
    expect(lockedVisibility({ hide_locked_modules: true, coming_soon_modules: ["payroll"] }, "payroll")).toEqual({ hidden: false, comingSoon: true });
  });
  it("keeps locked modules visible by default", () => {
    expect(lockedVisibility({}, "payroll").hidden).toBe(false);
  });
});
