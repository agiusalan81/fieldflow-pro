import { describe, expect, it } from "vitest";
import { canViewAsRoles, resolveDisplayedRole, type Role } from "./profile";

describe("assigned-role visibility", () => {
  const roles: Role[] = ["superuser", "admin", "supervisor", "technician"];
  it.each(["admin", "supervisor", "technician"] as const)("locks %s to its assigned role despite saved previews", role => {
    expect(canViewAsRoles(role)).toBe(false);
    for (const saved of roles) expect(resolveDisplayedRole(role, saved)).toBe(role);
  });
  it("lets only the real superuser inspect each role and reset", () => {
    expect(canViewAsRoles("superuser")).toBe(true);
    for (const role of roles) expect(resolveDisplayedRole("superuser", role)).toBe(role);
    expect(resolveDisplayedRole("superuser", null)).toBe("superuser");
  });
});