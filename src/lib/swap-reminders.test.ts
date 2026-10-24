import { describe, it, expect } from "vitest";
import { swapReminderDue } from "./swap-reminders";
describe("swap snooze reminders", () => {
  const now = Date.parse("2026-10-24T13:00:00Z");
  it("hides the reminder during its one-hour snooze", () => expect(swapReminderDue("2026-10-24T14:00:00Z", now)).toBe(false));
  it("returns the reminder after the snooze expires", () => expect(swapReminderDue("2026-10-24T14:00:00Z", now + 3600000)).toBe(true));
  it("shows requests that have never been snoozed", () => expect(swapReminderDue(null, now)).toBe(true));
});