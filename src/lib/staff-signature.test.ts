import { describe, expect, it } from "vitest";
import { staffSignatureEligible, validStaffSignature } from "./staff-signature";
describe("staff signature rules", () => {
  it("includes technicians", () => expect(staffSignatureEligible("technician")).toBe(true));
  it("includes supervisors", () => expect(staffSignatureEligible("supervisor")).toBe(true));
  it("excludes office admins", () => expect(staffSignatureEligible("admin")).toBe(false));
  it("excludes company superusers", () => expect(staffSignatureEligible("superuser")).toBe(false));
  it("accepts only bounded PNG data", () => { expect(validStaffSignature("data:image/png;base64,iVBORw0KGgo=")).toBe(true); expect(validStaffSignature("https://example.com/image.png")).toBe(false); expect(validStaffSignature("data:image/svg+xml;base64,abcd")).toBe(false); expect(validStaffSignature("data:image/png;base64," + "a".repeat(200000))).toBe(false); expect(validStaffSignature(null)).toBe(false); });
});