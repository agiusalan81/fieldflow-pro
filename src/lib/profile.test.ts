import { describe, expect, it } from "vitest";
import { canViewAsRoles, resolveDisplayedRole, isManager, type Profile, type Role } from "./profile";

describe("assigned-role visibility", () => {
  it('General Maintenance is never a manager or role-preview actor', () => { expect(isManager({role:'maintenance'} as Profile)).toBe(false); expect(canViewAsRoles('maintenance')).toBe(false); expect(resolveDisplayedRole('maintenance','superuser')).toBe('maintenance'); });
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