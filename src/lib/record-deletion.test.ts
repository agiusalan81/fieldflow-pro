import { describe, expect, it } from "vitest";
import { canDeleteSheet, canDeleteVisit } from "./record-deletion";

describe("record deletion visibility", () => {
  it("Superuser can delete sheets and dispatched jobs", () => {
    expect(canDeleteSheet("superuser")).toBe(true);
    expect(canDeleteVisit("superuser")).toBe(true);
  });
  it("Office Admin can delete job sheets and dispatched jobs", () => {
    expect(canDeleteSheet("admin")).toBe(true);
    expect(canDeleteVisit("admin")).toBe(true);
  });
  it("Supervisor can delete dispatched jobs but not other members' sheets", () => {
    expect(canDeleteVisit("supervisor")).toBe(true);
    expect(canDeleteSheet("supervisor")).toBe(false);
  });
  it("Technician has no manager deletion controls", () => {
    expect(canDeleteVisit("technician")).toBe(false);
    expect(canDeleteSheet("technician")).toBe(false);
    expect(canDeleteVisit(undefined)).toBe(false);
  });
});