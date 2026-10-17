import { describe, it, expect } from "vitest";
import { visitsForTier, contractName } from "./jobsheets";
describe("contract tiers", () => {
  it("Gold = 12 visits", () => expect(visitsForTier("Gold", 1)).toBe(12));
  it("Silver = 6 visits", () => expect(visitsForTier("Silver", 1)).toBe(6));
  it("Bronze = 4 visits", () => expect(visitsForTier("Bronze", 1)).toBe(4));
  it("Custom keeps manual count", () => expect(visitsForTier("Custom", 9)).toBe(9));
  it("names Residential Gold", () => expect(contractName("Residential", "Gold")).toBe("Residential Gold"));
});
