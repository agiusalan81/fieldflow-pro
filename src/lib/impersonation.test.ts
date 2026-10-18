import { describe, expect, it } from "vitest";
import { canPreviewUsers, resolvePreviewMember, type PreviewMember } from "./impersonation";
import type { Profile, Role } from "./profile";

const actor = (real_role: Role, role: Role = real_role) => ({ id: "self", company_id: "company-a", real_role, role }) as Profile;
const member: PreviewMember = { id: "tech", company_id: "company-a", full_name: "Test Technician", email: "tech@example.test", employee_id: null, technician_initials: "TT", role: "technician" };
describe("user testing preview", () => {
  it("is available to the real superuser even while viewing the technician role", () => {
    expect(canPreviewUsers(actor("superuser", "technician"))).toBe(true);
  });
  it.each(["admin", "supervisor", "technician"] as const)("does not grant %s preview access through simulated superuser mode", (role) => {
    expect(canPreviewUsers(actor(role, "superuser"))).toBe(false);
    expect(resolvePreviewMember(actor(role, "superuser"), { actorId: "self", userId: "tech" }, [member])).toBeNull();
  });
  it("resolves only a returned same-company member", () => {
    expect(resolvePreviewMember(actor("superuser"), { actorId: "self", userId: "tech" }, [member])?.id).toBe("tech");
    expect(resolvePreviewMember(actor("superuser"), { actorId: "self", userId: "missing" }, [member])).toBeNull();
    expect(resolvePreviewMember(actor("superuser"), { actorId: "self", userId: "tech" }, [{ ...member, company_id: "company-b" }])).toBeNull();
  });
  it("never replays a selection from another signed-in account", () => {
    expect(resolvePreviewMember(actor("superuser"), { actorId: "other", userId: "tech" }, [member])).toBeNull();
  });
  it("reset to self does not create a preview", () => {
    expect(resolvePreviewMember(actor("superuser"), null, [member])).toBeNull();
    expect(resolvePreviewMember(actor("superuser"), { actorId: "self", userId: "self" }, [member])).toBeNull();
  });
});