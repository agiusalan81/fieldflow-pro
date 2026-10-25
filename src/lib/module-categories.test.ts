import { describe, expect, it } from "vitest";
import { filterModules, groupModules, moduleCategory, moduleLayer, sortModules } from "./module-categories";

describe("module categories", () => {
  it("places site surveys under Clients & Commercial", () => {
    expect(moduleCategory("site_surveys")).toBe("Clients & Commercial");
  });
  it("sorts modules alphabetically by label within a category", () => {
    const g = groupModules(["standby", "fleet_management", "tracking"]);
    expect(g).toHaveLength(2);
    expect(g[0]?.modules).toEqual(["standby"]);
    expect(g[1]?.modules).toEqual(["fleet_management", "tracking"]);
  });
  it("keeps customer quoting in Core independently of lift RFQs", () => {
    expect(moduleLayer("customer_quotes")).toBe("core");
    expect(moduleLayer("estimates")).toBe("vertical");
    expect(moduleLayer("supplier_email")).toBe("vertical");
    expect(moduleLayer("lift_pack")).toBe("vertical");
  });
  it("keeps general surveys and skills horizontal", () => {
    expect(moduleLayer("site_surveys")).toBe("horizontal");
    expect(moduleLayer("skills_dispatch")).toBe("horizontal");
  });
  it("combines layer and domain filters without losing custom modules", () => {
    expect(filterModules(["core", "tracking", "fleet_management", "custom"], "horizontal", "Fleet & Location")).toEqual(["fleet_management", "tracking"]);
    expect(filterModules(["custom", "lift_pack"], "horizontal")).toEqual(["custom"]);
  });
  it("keeps category order and puts unknown modules last", () => {
    expect(sortModules(["zzz_custom", "payroll", "core"])).toEqual(["core", "payroll", "zzz_custom"]);
  });
});
