import { afterEach, describe, expect, it, vi } from "vitest";
import { withInviteTimeout } from "./invite-loading";

afterEach(() => vi.useRealTimers());

describe("invitation loading", () => {
  it("returns a successful lookup", async () => {
    await expect(withInviteTimeout(async () => ({ valid: true }))).resolves.toEqual({ valid: true });
  });
  it("preserves a missing invitation instead of treating it as a connection failure", async () => {
    await expect(withInviteTimeout(async () => null)).resolves.toBeNull();
  });
  it("rejects and aborts a stalled lookup after ten seconds", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const result = withInviteTimeout((s) => { signal = s; return new Promise(() => {}); });
    const assertion = expect(result).rejects.toThrow("Could not check your invitation");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });
  it("propagates request errors without waiting for the timeout", async () => {
    vi.useFakeTimers();
    await expect(withInviteTimeout(async () => { throw new Error("network failed"); })).rejects.toThrow("network failed");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("allows a fresh lookup after a failed attempt", async () => {
    await expect(withInviteTimeout(async () => { throw new Error("offline"); })).rejects.toThrow();
    await expect(withInviteTimeout(async () => ({ valid: true }))).resolves.toEqual({ valid: true });
  });
});