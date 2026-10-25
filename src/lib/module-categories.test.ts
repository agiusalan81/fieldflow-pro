import { describe, expect, it } from "vitest";
import { groupModules, moduleCategory, sortModules } from "./module-categories";

describe("module categories", () => {
  it("places site surveys under Clients & Commercial", () => {
    expect(moduleCategory("site_surveys")).toBe("Clients & Commercial");
  });
  it("sorts modules alphabetically by label within a category", () => {
    const g = groupModules(["standby", "fleet_management", "tracking"]);
    expect(g).toHaveLength(1);
    expect(g[0]!.modules).toEqual(["fleet_management", "standby", "tracking"]);
  });
  it("keeps category order and puts unknown modules last", () => {
    expect(sortModules(["zzz_custom", "payroll", "core"])).toEqual(["core", "payroll", "zzz_custom"]);
  });
});
