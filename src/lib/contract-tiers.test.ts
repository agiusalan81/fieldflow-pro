import { describe, it, expect } from "vitest";
import { visitsForTier, contractName } from "./jobsheets";
describe("contract tiers", () => {
  it("Gold = 12 visits", () => expect(visitsForTier("Gold", 1)).toBe(12));
  it("Silver = 6 visits", () => expect(visitsForTier("Silver", 1)).toBe(6));
  it("Bronze = 4 visits", () => expect(visitsForTier("Bronze", 1)).toBe(4));
  it("Custom keeps manual count", () => expect(visitsForTier("Custom", 9)).toBe(9));
  it("names Residential Gold", () => expect(contractName("Residential", "Gold")).toBe("Residential Gold"));
});
import { needsClockIn } from "./jobsheets";
describe("clock-in guard", () => {
  it("blocks off-shift technician", () => expect(needsClockIn("technician", [])).toBe(true));
  it("allows clocked-in technician", () => expect(needsClockIn("technician", ["shift"])).toBe(false));
  it("travel alone is not clocked in", () => expect(needsClockIn("technician", ["travel"])).toBe(true));
  it("supervisors exempt", () => expect(needsClockIn("supervisor", [])).toBe(false));
});
import { approvalBalance } from "./jobsheets";
describe("leave approval balance", () => {
  it("48 h available, 24 h request leaves 24 h", () => expect(approvalBalance({ base: 48, ph: 0, taken: 0, pending: 24 }, 24)).toEqual({ available: 48, after: 24, exceedsBy: 0 }));
  it("flags over-allocation by 8 h", () => expect(approvalBalance({ base: 16, ph: 0, taken: 0, pending: 24 }, 24).exceedsBy).toBe(8));
});
