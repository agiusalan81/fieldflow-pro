import { describe, it, expect } from "vitest";
import { splitHours, scheduledInitials, assignmentFilter, isAssisting } from "./jobsheets";
import { leaveHours, remainingBalance, missingSignOff, hoursFromTimes } from "./jobsheets";

describe("job sheet & leave rules", () => {
  it("equal endpoints create no standard or overtime hours", () => expect(splitHours("2026-10-19", "21:53", "21:53")).toEqual({ standard: 0, ot15: 0, ot20: 0 }));
  it("both assigned technicians are seeded into shared daily logs", () => {
    const job = { assigned_technician_id: "lead", secondary_technician_id: "assistant" };
    expect(scheduledInitials(job, [{ id: "lead", full_name: "Alan Agius", technician_initials: "AA" }, { id: "assistant", full_name: "Test Technician", technician_initials: "TT" }], { full_name: "Alan Agius" })).toEqual(["AA", "TT"]);
    expect(isAssisting(job, "assistant")).toBe(true);
    expect(isAssisting(job, "lead")).toBe(false);
    expect(assignmentFilter("assistant")).toBe("assigned_technician_id.eq.assistant,secondary_technician_id.eq.assistant");
  });
  it("remaining balance = base + PH credit - taken - pending", () => {
    expect(remainingBalance({ base: 192, ph: 16, taken: 40, pending: 8 })).toBe(160);
  });
  it("leave hours count weekdays only at 8h", () => {
    // Fri 2026-10-16 to Mon 2026-10-19 → Fri + Mon
    expect(leaveHours("2026-10-16", "2026-10-19")).toBe(16);
  });
  it("submission blocked without client name, ID card and signature", () => {
    expect(missingSignOff({ client_full_name: "A", client_id_card_no: "", signature: "x" })).toEqual(["Client ID card no."]);
    expect(missingSignOff({ client_full_name: "A", client_id_card_no: "1", signature: "x" })).toEqual([]);
  });
  it("daily hours from time in/out", () => {
    expect(hoursFromTimes("08:00", "12:30")).toBe(4.5);
  });
});

import { roundTo15, shiftTime } from "./jobsheets";
describe("15-minute time rounding", () => {
  it("rounds to the nearest quarter hour", () => {
    expect(roundTo15("08:07")).toBe("08:00");
    expect(roundTo15("08:08")).toBe("08:15");
    expect(roundTo15("23:53")).toBe("00:00");
  });
  it("+/- buttons move by 15 minutes", () => {
    expect(shiftTime("08:00", 15)).toBe("08:15");
    expect(shiftTime("00:00", -15)).toBe("23:45");
  });
});

import { dayLabourHours } from "./jobsheets";
describe("travel with several technicians", () => {
  it("travel is multiplied by technician count like site hours", () => expect(dayLabourHours("08:00", "10:00", 1, 2)).toBe(6));
  it("time acquiring parts is added before multiplying by technician count", () => {
    expect(dayLabourHours("08:00", "10:00", 1, 2, [], 0.5)).toBe(7);
    expect(dayLabourHours("08:00", "10:00", 0, 1, [], 1)).toBe(3);
  });
  it("applies a 1-hour minimum charge per technician once any work is logged", () => {
    expect(dayLabourHours("08:00", "08:20", 0.2, 1)).toBe(1);
    expect(dayLabourHours("08:00", "08:20", 0.2, 2)).toBe(2);
    expect(dayLabourHours(null, null, 0, 1)).toBe(0);
  });
});
