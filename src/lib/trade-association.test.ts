import { describe, expect, it } from "vitest";
import { companyHasLiftTrade, companyTradeOptions, isLiftTrade, tradeFamily } from "./trade-association";

describe("trade associations", () => {
  it.each(["lifts", "elevators", "passenger lifts", "goods lift", "Lifts & Escalators", "platform lift", "service lifts", "dumbwaiter"])("associates %s with lifts", value => expect(isLiftTrade(value)).toBe(true));
  it("does not mistake forklift or lift station for company lift pricing", () => {
    expect(isLiftTrade("forklift servicing")).toBe(false);
    expect(companyHasLiftTrade("Plumbing", ["drains"])).toBe(false);
  });
  it("enables lift pricing from additional company trades", () => expect(companyHasLiftTrade("Electrical", ["Goods lifts"])).toBe(true));
  it("keeps company choices and removes duplicate names", () => expect(companyTradeOptions("Lifts", ["lifts", "Electrical"], ["Passenger elevator"])).toEqual(["Electrical", "lifts", "Passenger elevator"]));
  it.each([["air conditioning", "hvac"], ["pipework", "plumbing"], ["solar EV", "electrical"]])("associates %s", (value, family) => expect(tradeFamily(value)).toBe(family));
});