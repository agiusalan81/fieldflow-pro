import { describe, it, expect } from "vitest";
import { splitHours, missingChecklist, dueForRenewal, DEFAULT_RULES } from "./jobsheets";
import { canSee } from "./permissions";

// 2026-10-19 is a Monday, 2026-10-24 Saturday, 2026-10-25 Sunday
describe("overtime split", () => {
  it("weekday inside working hours is standard 1.0×", () => {
    expect(splitHours("2026-10-19", "08:00", "12:00")).toEqual({ standard: 4, ot15: 0, ot20: 0 });
  });
  it("weekday after closing time is 1.5×", () => {
    expect(splitHours("2026-10-19", "15:30", "18:30")).toEqual({ standard: 1, ot15: 2, ot20: 0 });
  });
  it("Saturday is 1.5×", () => {
    expect(splitHours("2026-10-24", "09:00", "11:00")).toEqual({ standard: 0, ot15: 2, ot20: 0 });
  });
  it("Sunday is 2.0×", () => {
    expect(splitHours("2026-10-25", "09:00", "10:30")).toEqual({ standard: 0, ot15: 0, ot20: 1.5 });
  });
  it("public holiday is 2.0× even on a weekday", () => {
    expect(splitHours("2026-10-19", "08:00", "10:00", { ...DEFAULT_RULES, public_holidays: ["2026-10-19"] })).toEqual({ standard: 0, ot15: 0, ot20: 2 });
  });
  it("Saturday night into Sunday splits 1.5× then 2.0×", () => {
    expect(splitHours("2026-10-24", "23:00", "01:00")).toEqual({ standard: 0, ot15: 1, ot20: 1 });
  });
});

describe("maintenance checklist", () => {
  it("lists unticked items", () => {
    expect(missingChecklist(["Brakes", "Doors"], { Brakes: true })).toEqual(["Doors"]);
  });
});

describe("renewal reminders", () => {
  it("starts 30 days before expiry", () => {
    expect(dueForRenewal("2026-11-16", 30, "2026-10-17")).toBe(true);
    expect(dueForRenewal("2026-11-17", 30, "2026-10-17")).toBe(false);
  });
});

describe("role module access", () => {
  it("technician cannot see billing by default; superuser override grants it", () => {
    expect(canSee("technician", "billing", [])).toBe(false);
    expect(canSee("technician", "billing", [{ role: "technician", module: "billing", enabled: true }])).toBe(true);
  });
  it("supervisor cannot see contracts by default", () => {
    expect(canSee("supervisor", "contracts", [])).toBe(false);
  });
  it("superuser always sees everything", () => {
    expect(canSee("superuser", "team", [{ role: "superuser", module: "team", enabled: false }])).toBe(true);
  });
});
