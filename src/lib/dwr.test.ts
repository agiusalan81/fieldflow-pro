import { describe, it, expect } from "vitest";
import { mandatoryBreaks, workedHours, matchesSheetSearch, sheetTitle, standbyFor } from "./dwr";

const one30 = { enabled: true, count: 1, minutes: 30 };

describe("mandatory breaks", () => {
  it("one 30-min break lands mid-shift on an 8h shift", () => expect(mandatoryBreaks("07:30", "15:30", one30)).toEqual([{ from: "11:15", to: "11:45" }]));
  it("is recorded even if not taken: 8h shift pays 7.5h", () => expect(workedHours("07:30", "15:30", one30)).toBe(7.5));
  it("two breaks of 15 min", () => expect(mandatoryBreaks("08:00", "17:00", { enabled: true, count: 2, minutes: 15 })).toHaveLength(2));
  it("switched off in settings = no break", () => expect(workedHours("07:30", "15:30", { ...one30, enabled: false })).toBe(8));
});

describe("job sheet number search", () => {
  it("76 finds 007611", () => expect(matchesSheetSearch("007611", [], "76")).toBe(true));
  it("#76 finds 007611", () => expect(matchesSheetSearch("007611", [], "#76")).toBe(true));
  it("7611 without zeros", () => expect(matchesSheetSearch("007611", [], "7611")).toBe(true));
  it("99 does not find 007611", () => expect(matchesSheetSearch("007611", ["Acme"], "99")).toBe(false));
  it("still finds by client name", () => expect(matchesSheetSearch("007611", ["Acme Towers"], "acme")).toBe(true));
  it("PDF title", () => expect(sheetTitle("007611")).toBe("Job sheet- 007611"));
});

describe("standby roster", () => {
  const c = { start: "2026-10-12", rotationDays: 7, perShift: 1, order: ["a", "b", "c"] };
  it("weekly: one tech per week", () => {
    expect(standbyFor("2026-10-12", c)).toEqual(["a"]);
    expect(standbyFor("2026-10-18", c)).toEqual(["a"]);
    expect(standbyFor("2026-10-19", c)).toEqual(["b"]);
  });
  it("every 2 days rotates", () => expect(standbyFor("2026-10-14", { ...c, rotationDays: 2 })).toEqual(["b"]));
  it("3 techs per shift", () => expect(standbyFor("2026-10-12", { ...c, perShift: 3, order: ["a", "b", "c", "d", "e", "f"] })).toEqual(["a", "b", "c"]));
  it("accepted swap replaces the requester for that day only", () => {
    const swaps = [{ swap_date: "2026-10-13", requester_id: "a", target_id: "c", status: "accepted" }];
    expect(standbyFor("2026-10-13", c, swaps)).toEqual(["c"]);
    expect(standbyFor("2026-10-14", c, swaps)).toEqual(["a"]);
  });
  it("pending swap changes nothing", () => expect(standbyFor("2026-10-13", c, [{ swap_date: "2026-10-13", requester_id: "a", target_id: "c", status: "pending" }])).toEqual(["a"]));
});
