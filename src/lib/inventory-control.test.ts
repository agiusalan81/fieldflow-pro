import { describe, expect, it } from "vitest";
import { canAdjustStock, canSignIn, canSignOut, isOverdue, statusAfterReturn } from "./inventory-control";

describe("tool checkout policy", () => {
  it("managed mode: technician cannot sign out, even to self", () => expect(canSignOut("technician", "managed", "a", "a")).toBe(false));
  it("managed mode: supervisor signs out to anyone", () => expect(canSignOut("supervisor", "managed", "s", "a")).toBe(true));
  it("self-service: technician signs out to self only", () => {
    expect(canSignOut("technician", "self_service", "a", "a")).toBe(true);
    expect(canSignOut("technician", "self_service", "a", "b")).toBe(false);
  });
  it("self-service: technician returns only own tool", () => {
    expect(canSignIn("technician", "self_service", "a", "a")).toBe(true);
    expect(canSignIn("technician", "self_service", "a", "b")).toBe(false);
    expect(canSignIn("technician", "managed", "a", "a")).toBe(false);
  });
  it("damaged return goes to repair", () => expect(statusAfterReturn("needs_maintenance")).toBe("in_maintenance"));
  it("overdue after expected date", () => {
    expect(isOverdue("2026-01-01", "2026-01-02")).toBe(true);
    expect(isOverdue("2026-01-02", "2026-01-02")).toBe(false);
  });
});

describe("parts control policy", () => {
  it("managed: technician cannot adjust stock", () => expect(canAdjustStock("technician", "managed", false)).toBe(false));
  it("self-service: technician adjusts non-approval parts only", () => {
    expect(canAdjustStock("technician", "self_service", false)).toBe(true);
    expect(canAdjustStock("technician", "self_service", true)).toBe(false);
  });
  it("admin always adjusts", () => expect(canAdjustStock("admin", "managed", true)).toBe(true));
});
