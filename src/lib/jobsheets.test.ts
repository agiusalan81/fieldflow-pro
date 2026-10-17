import { describe, it, expect } from "vitest";
import { leaveHours, remainingBalance, missingSignOff, hoursFromTimes } from "./jobsheets";

describe("job sheet & leave rules", () => {
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
});
