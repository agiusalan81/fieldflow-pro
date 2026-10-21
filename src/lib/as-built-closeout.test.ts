import { describe, it, expect } from "vitest";
import { finalQty, unresolved, finalAccount, type SurveyLine } from "./as-built";
const l = (id: string, estimated: number, installed: number): SurveyLine => ({ id, category: "", name: id, unit: "each", estimated, installed });
describe("survey close-out", () => {
  it("defaults to installed quantity", () => expect(finalQty(l("a", 10, 12))).toBe(12));
  it("holds to estimate", () => expect(finalQty(l("a", 10, 12), { decision: "estimate", reason: "x" })).toBe(10));
  it("uses adjusted quantity, never below zero", () => { expect(finalQty(l("a", 10, 12), { decision: "adjust", qty: 11 })).toBe(11); expect(finalQty(l("a", 1, 1), { decision: "adjust", qty: -3 })).toBe(0); });
  it("flags undecided variances and reasonless overrides", () => {
    const lines = [l("a", 10, 10), l("b", 10, 12), l("c", 5, 4)];
    expect(unresolved(lines, {}).map((x) => x.id)).toEqual(["b", "c"]);
    expect(unresolved(lines, { b: { decision: "accept" }, c: { decision: "adjust", qty: 5 } }).map((x) => x.id)).toEqual(["c"]);
    expect(unresolved(lines, { b: { decision: "accept" }, c: { decision: "adjust", qty: 5, reason: "client agreed" } })).toEqual([]);
  });
  it("totals final account at rates", () => expect(finalAccount([l("a", 10, 12)], {}, () => 5)).toEqual({ estimated: 50, final: 60, difference: 10 }));
});
