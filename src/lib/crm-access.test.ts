import { describe, expect, it } from "vitest";
import { crmAllows, crmDefaultLevel, crmEffective, leadValueLabel } from "./crm";

describe("crm member access", () => {
  it("defaults admins to manager, supervisors to closer and field staff to no access", () => {
    expect(crmDefaultLevel("admin")).toBe("manager");
    expect(crmDefaultLevel("supervisor")).toBe("closer");
    expect(crmDefaultLevel("technician")).toBe("none");
  });
  it("superuser is always manager even with an explicit lower level", () => {
    expect(crmEffective("superuser", "viewer")).toBe("manager");
  });
  it("explicit level overrides the role default", () => {
    expect(crmEffective("technician", "contributor")).toBe("contributor");
    expect(crmEffective("admin", "viewer")).toBe("viewer");
  });
  it("contributors can add leads but not close or delete", () => {
    expect(crmAllows("contributor", "contributor")).toBe(true);
    expect(crmAllows("contributor", "closer")).toBe(false);
    expect(crmAllows("closer", "manager")).toBe(false);
    expect(crmAllows("manager", "manager")).toBe(true);
    expect(crmAllows("viewer", "contributor")).toBe(false);
  });
  it("unknown lead value shows TBD, not zero", () => {
    expect(leadValueLabel(null, (n) => `€${n}`)).toBe("TBD");
    expect(leadValueLabel(0, (n) => `€${n}`)).toBe("€0");
  });
});
