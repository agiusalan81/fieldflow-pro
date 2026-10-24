import { describe, expect, it } from "vitest";
import { canManageMember, canSeeMember, memberFullName, registrationDuration, splitMemberName } from "./member-registration";
describe("member registration", () => {
  it('supervisors see Maintenance without giving Maintenance manager control',()=>{expect(canSeeMember('supervisor','maintenance')).toBe(true);expect(canManageMember('maintenance','a',{id:'b',role:'technician'})).toBe(false);});
  it("requires both names for social and email signup", () => {
    expect(memberFullName(" Alan ", " Agius ")).toBe("Alan Agius");
    expect(() => memberFullName("Alan", "")).toThrow();
    expect(splitMemberName("Alan Charles Agius")).toEqual({ firstName: "Alan", surname: "Charles Agius" });
  });
  it("never allows self revocation", () => expect(canManageMember("superuser", "a", { id: "a", role: "technician" })).toBe(false));
  it("office admins cannot revoke a company superuser", () => expect(canManageMember("admin", "a", { id: "b", role: "superuser" })).toBe(false));
  it("supervisors cannot revoke employees", () => expect(canManageMember("supervisor", "a", { id: "b", role: "technician" })).toBe(false));
  it("office admins may revoke technicians", () => expect(canManageMember("admin", "a", { id: "b", role: "technician" })).toBe(true));
  it("tenant revocation cannot affect platform authority", () => expect(canManageMember("superuser", "a", { id: "b", role: "admin", platform_owner: true })).toBe(false));
  it("tenure ends at termination", () => expect(registrationDuration("2026-10-01T00:00:00Z", "2026-10-09T00:00:00Z", new Date("2027-10-01"))).toBe("8 days"));
});