import { expect, it } from "vitest";
import { guideSteps, guideKey } from "./onboarding";
it("technicians are not guided into team management or payroll", () => expect(guideSteps("technician").some(s=>s.to==="/team" || s.to.startsWith("/payroll"))).toBe(false));
it("supervisors have team guidance but not wages", () => { expect(guideSteps("supervisor").some(s=>s.to==="/team")).toBe(true); expect(guideSteps("supervisor").some(s=>s.to.startsWith("/payroll"))).toBe(false); });
it("office admins have wage guidance", () => expect(guideSteps("admin").some(s=>s.to==="/payroll/wages")).toBe(true));
it("welcome completion is isolated by both account and company", () => { expect(guideKey("a","x")).not.toBe(guideKey("b","x")); expect(guideKey("a","x")).not.toBe(guideKey("a","y")); });