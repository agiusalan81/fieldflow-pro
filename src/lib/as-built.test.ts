import { describe, expect, it } from "vitest";
import { linesFromProposal, tally, variance, varianceValue, type SurveyLine } from "./as-built";

const l = (estimated: number, installed: number): SurveyLine => ({ id: "a", category: "", name: "Socket", unit: "point", estimated, installed });

describe("as-built QS", () => {
  it("tally never goes below zero", () => { expect(tally(l(5, 0), -1).installed).toBe(0); expect(tally(l(5, 2), 1).installed).toBe(3); });
  it("variance: 12 installed vs 10 estimated is +2 / 20% over", () => { expect(variance(l(10, 12))).toEqual({ diff: 2, pct: 20, status: "over" }); });
  it("optional proposal alternatives are not surveyed", () => {
    const s = linesFromProposal([{ id: "1", category: "", name: "A", unit: "each", quantity: 3 }, { id: "2", category: "", name: "B", unit: "each", quantity: 1, optional: true }]);
    expect(s.map((x) => [x.name, x.estimated, x.installed])).toEqual([["A", 3, 0]]);
  });
  it("variance value uses rates: 2 extra × €15 = €30, under 1 × €10 = −€10", () => {
    expect(varianceValue([{ ...l(10, 12), name: "X" }, { ...l(4, 3), name: "Y" }], (x) => (x.name === "X" ? 15 : 10))).toBe(20);
  });
});
