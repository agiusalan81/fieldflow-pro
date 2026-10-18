import { describe, it, expect } from "vitest";
import { mandatoryBreaks, workedHours, matchesSheetSearch, sheetTitle, standbyFor, validStandbyStaffing, clampStandbyStaffing } from "./dwr";

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
  it("does not allow staffing above the number of registered technicians", () => {
    expect(validStandbyStaffing(3, 2)).toBe(false);
    expect(validStandbyStaffing(2, 2)).toBe(true);
    expect(clampStandbyStaffing(3, 2)).toBe(2);
  });
  it("does not allow saving a staffed roster with no registered technicians", () => {
    expect(validStandbyStaffing(1, 0)).toBe(false);
    expect(clampStandbyStaffing(1, 0)).toBe(0);
  });
  it("supports the registered team size rather than an arbitrary ten-person cap", () => {
    expect(validStandbyStaffing(40, 40)).toBe(true);
    expect(clampStandbyStaffing(41, 40)).toBe(40);
  });
  it("only accepts positive whole-person staffing", () => {
    expect(validStandbyStaffing(1.5, 3)).toBe(false);
    expect(validStandbyStaffing(0, 3)).toBe(false);
    expect(validStandbyStaffing(Number.NaN, 3)).toBe(false);
  });
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

import { heldDwrDueAt, shiftForgotten, autoClockOutAt } from "./dwr";
describe("held standby DWR and auto clock-out", () => {
  const start = new Date(2026, 9, 19, 7, 30).toISOString();
  it("standby DWR is due next morning at company start time", () => {
    expect(heldDwrDueAt(start, "07:30").getTime()).toBe(new Date(2026, 9, 20, 7, 30).getTime());
  });
  it("a shift is forgotten only after its day has passed", () => {
    expect(shiftForgotten(start, new Date(2026, 9, 19, 23, 59))).toBe(false);
    expect(shiftForgotten(start, new Date(2026, 9, 20, 0, 1))).toBe(true);
  });
  it("job finishing 16:30 after 16:00 closing keeps the overtime", () => {
    expect(autoClockOutAt(start, "16:00", "16:30").getTime()).toBe(new Date(2026, 9, 19, 16, 30).getTime());
  });
  it("adds recorded travel after the last job", () => {
    expect(autoClockOutAt(start, "16:00", "16:30", 0.5).getTime()).toBe(new Date(2026, 9, 19, 17, 0).getTime());
  });
  it("snaps to closing time when the last job ended earlier", () => {
    expect(autoClockOutAt(start, "16:00", "15:30").getTime()).toBe(new Date(2026, 9, 19, 16, 0).getTime());
  });
});
