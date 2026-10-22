import { describe, expect, it } from "vitest";
import { clampTeamSize, hasMandatorySkills, placesLeft, skillMatchScore } from "./skills";

describe("skills dispatch rules", () => {
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
