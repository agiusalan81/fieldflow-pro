import { describe, it, expect } from "vitest";
import { shouldAutoLogout, clampIdle } from "./idle";

const min = 60_000;
describe("inactivity logout", () => {
  it("logs out an idle admin after the timeout", () => {
    expect(shouldAutoLogout({ idleMs: 30 * min, timeoutMin: 30, isTechnician: false, clockedIn: false })).toBe(true);
  });
  it("never logs out a clocked-in technician", () => {
    expect(shouldAutoLogout({ idleMs: 500 * min, timeoutMin: 15, isTechnician: true, clockedIn: true })).toBe(false);
  });
  it("logs out a technician who is not clocked in", () => {
    expect(shouldAutoLogout({ idleMs: 16 * min, timeoutMin: 15, isTechnician: true, clockedIn: false })).toBe(true);
  });
  it("keeps any clocked-in field worker signed in, including supervisors", () => {
    expect(shouldAutoLogout({ idleMs: 500 * min, timeoutMin: 15, isTechnician: false, clockedIn: true })).toBe(false);
  });
  it("keeps a loaded test session signed in even without a shift", () => {
    expect(shouldAutoLogout({ idleMs: 500 * min, timeoutMin: 15, isTechnician: true, clockedIn: false, testing: true })).toBe(false);
  });
  it("caps timeout at 3 hours", () => {
    expect(clampIdle(600)).toBe(180);
  });
  it("disabled never logs out", () => {
    expect(shouldAutoLogout({ idleMs: 999 * min, timeoutMin: 0, isTechnician: false, clockedIn: false })).toBe(false);
  });
});
