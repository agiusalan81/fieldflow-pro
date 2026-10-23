import { describe, expect, it } from "vitest";
import { clampTeamSize, dispatchTeamSize, hasMandatorySkills, placesLeft, skillMatchScore, skillEligible } from "./skills";

describe("skills dispatch rules", () => {
  it("assigns skills to technicians and supervisors only", () => { expect(skillEligible("technician")).toBe(true); expect(skillEligible("supervisor")).toBe(true); expect(skillEligible("admin")).toBe(false); expect(skillEligible("superuser")).toBe(false); });
  it("allows lead plus assistant despite a hidden team-size default of 1", () => { expect(dispatchTeamSize(1, false, 2)).toBe(2); });
  it("keeps a single-person standard visit at 1", () => { expect(dispatchTeamSize(1, false, 1)).toBe(1); });
  it("does not allow three-person standard dispatch", () => { expect(dispatchTeamSize(3, false, 3)).toBe(2); });
  it("keeps explicit Smart Dispatch capacity", () => { expect(dispatchTeamSize(6, true, 2)).toBe(6); });
  it("allows a 6-person installation crew with the module", () => { expect(clampTeamSize(6, true)).toBe(6); });
  it("keeps standard dispatch to lead plus one assistant without the module", () => { expect(clampTeamSize(6, false)).toBe(2); });
  it("never allows a team smaller than one", () => { expect(clampTeamSize(0, true)).toBe(1); });
  it("requires every mandatory skill", () => {
    expect(hasMandatorySkills(["electrical", "plumbing"], ["electrical"])).toBe(true);
    expect(hasMandatorySkills(["electrical"], ["electrical", "welding"])).toBe(false);
  });
  it("ranks by matched skills", () => { expect(skillMatchScore(["electrical", "welding", "cctv"], ["cctv", "welding", "it"])).toBe(2); });
  it("counts remaining places", () => { expect(placesLeft(6, 4)).toBe(2); expect(placesLeft(2, 3)).toBe(0); });
});
