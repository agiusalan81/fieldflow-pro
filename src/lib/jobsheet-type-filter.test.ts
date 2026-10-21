import { describe, it, expect } from "vitest";
import { matchesSheetType } from "./jobsheet-type-filter";
describe("job sheet type filter", () => {
  const maint = { is_maintenance: true };
  it("all shows every sheet", () => expect(matchesSheetType({}, "all")).toBe(true));
  it("maintenance matches only maintenance", () => { expect(matchesSheetType(maint, "maintenance")).toBe(true); expect(matchesSheetType(maint, "installation")).toBe(false); });
  it("technical assistance matches", () => expect(matchesSheetType({ is_tech_assistance: true }, "tech_assistance")).toBe(true));
  it("multi-type sheet matches each of its types", () => { const s = { is_installation: true, is_maintenance: true }; expect(matchesSheetType(s, "installation")).toBe(true); expect(matchesSheetType(s, "maintenance")).toBe(true); });
});
