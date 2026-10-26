import { describe, expect, it } from "vitest";
import { canEditCapabilities, isDispatchable, showsFieldDispatchToggle } from "./member-capabilities";

describe("member capabilities", () => {
  it("office admin without the toggle is not dispatchable", () => expect(isDispatchable("admin", true, false)).toBe(false));
  it("office admin with field dispatch is dispatchable", () => expect(isDispatchable("admin", true, true)).toBe(true));
  it("technicians are dispatchable by primary role", () => expect(isDispatchable("technician", true, false)).toBe(true));
  it("revoked members are never dispatchable", () => expect(isDispatchable("admin", false, true)).toBe(false));
  it("toggle shown only for office roles", () => {
    expect(showsFieldDispatchToggle("superuser")).toBe(true);
    expect(showsFieldDispatchToggle("technician")).toBe(false);
  });
  it("admins cannot change a superuser's capabilities", () => expect(canEditCapabilities("admin", "superuser")).toBe(false));
  it("supervisors cannot change capabilities", () => expect(canEditCapabilities("supervisor", "admin")).toBe(false));
  it("superuser can change own capabilities", () => expect(canEditCapabilities("superuser", "superuser")).toBe(true));
});
