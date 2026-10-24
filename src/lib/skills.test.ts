import { describe, expect, it } from "vitest";
import { activeSkillMember, assignedSkills, canManageSkills, groupSkills, clampTeamSize, dispatchTeamSize, hasMandatorySkills, placesLeft, skillMatchScore, skillEligible, matchesTrade } from "./skills";

describe("skills dispatch rules", () => {
  it("hides skill management from technicians and maintenance staff", () => { expect(canManageSkills("technician")).toBe(false); expect(canManageSkills("maintenance")).toBe(false); expect(canManageSkills("supervisor")).toBe(true); expect(canManageSkills("admin")).toBe(true); expect(canManageSkills("superuser")).toBe(true); });
  it("excludes terminated members from skill assignment", () => { expect(activeSkillMember("technician", "terminated")).toBe(false); expect(activeSkillMember("supervisor", "active")).toBe(true); expect(activeSkillMember("maintenance", "active")).toBe(true); expect(activeSkillMember("admin", "active")).toBe(false); });
  it("shows Bob's welding and electrical only, never auto-assigning newly created skills", () => {
    const skills = [{ id: "w", archived: false }, { id: "e", archived: false }, { id: "new", archived: false }, { id: "old", archived: true }];
    const links = [{ user_id: "bob", skill_id: "w" }, { user_id: "bob", skill_id: "e" }, { user_id: "bob", skill_id: "old" }, { user_id: "other", skill_id: "new" }];
    expect(assignedSkills(skills, links, "bob").map(s => s.id)).toEqual(["w", "e"]);
  });
  it("groups dynamically added skills by optional category", () => { expect(groupSkills([{ category: "Trades" }, { category: "" }, { category: "Trades" }]).map(([name, rows]) => [name, rows.length])).toEqual([["Trades", 2], ["Other skills", 1]]); });
  it('filters Mechanical Electrical and IT using skills rather than new roles',()=>{expect(matchesTrade(['Mechanical'],'Electrical')).toBe(false);expect(matchesTrade(['Electrical'],'Electrical')).toBe(true);expect(matchesTrade(['IT / Electronics'],'IT')).toBe(true);expect(matchesTrade(['Mechanical'],'Mechanical')).toBe(true);});
  it('allows General Maintenance field skills without office eligibility',()=>{expect(skillEligible('maintenance')).toBe(true);expect(skillEligible('admin')).toBe(false);});
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
