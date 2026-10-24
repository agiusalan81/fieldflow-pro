import { describe, expect, it } from "vitest";
import { lockedVisibility, navEntryLocked } from "./plan-features";

describe("HQ locked module visibility", () => {
  it("hides every locked module when hide locked is on", () => {
    expect(lockedVisibility({ hide_locked_modules: true }, "payroll").hidden).toBe(true);
  });
  it("shows Coming soon modules even when hide locked is on", () => {
    expect(lockedVisibility({ hide_locked_modules: true, coming_soon_modules: ["payroll"] }, "payroll")).toEqual({ hidden: false, comingSoon: true });
  });
  it("keeps locked modules visible by default", () => {
    expect(lockedVisibility({}, "payroll").hidden).toBe(false);
  });
});

describe("menu entry locking", () => {
  const on = { state: "active", modules: [{ name: "technical_library", enabled: true }] };
  it("greys a Coming soon module even when the package enables it", () => {
    expect(navEntryLocked({ ...on, coming_soon_modules: ["technical_library"] }, "technical_library")).toEqual({ locked: true, soon: true, hidden: false });
  });
  it("locks a module the package switches off", () => {
    expect(navEntryLocked({ state: "active", modules: [{ name: "payroll", enabled: false }] }, "payroll").locked).toBe(true);
  });
  it("leaves enabled non-coming-soon modules unlocked", () => {
    expect(navEntryLocked(on, "technical_library")).toEqual({ locked: false, soon: false, hidden: false });
  });
  it("never hides a Coming soon module", () => {
    expect(navEntryLocked({ ...on, hide_locked_modules: true, coming_soon_modules: ["technical_library"] }, "technical_library").hidden).toBe(false);
  });
});
