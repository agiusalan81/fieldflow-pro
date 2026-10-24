import { describe, it, expect } from "vitest";
import { freeForRange, rotaFor, validRota, weeklyRota, activeRotaMember } from "./rota";
const tech = { start: "2026-10-23", rotationDays: 7, perShift: 1, order: ["t1", "t2"] };
const supervisor = { ...tech, rotationDays: 2, order: ["s1", "s2"] };
describe("dual-track on-call rota", () => {
  it("rotates supervisors independently on the same date", () => { expect(rotaFor("2026-10-25", tech, [], "technician")).toEqual(["t1"]); expect(rotaFor("2026-10-25", supervisor, [], "supervisor")).toEqual(["s2"]); });
  it("does not apply swaps from another track", () => { expect(rotaFor("2026-10-23", tech, [{ swap_date: "2026-10-23", requester_id: "t1", target_id: "s1", status: "accepted", manager_approved: true, track: "supervisor" }], "technician")).toEqual(["t1"]); });
  it("requires manager approval for supervisor swaps", () => { expect(rotaFor("2026-10-23", supervisor, [{ swap_date: "2026-10-23", requester_id: "s1", target_id: "s2", status: "accepted", manager_approved: false, track: "supervisor" }], "supervisor")).toEqual(["s1"]); });
  it("applies approved supervisor range swaps", () => { expect(rotaFor("2026-10-24", supervisor, [{ swap_date: "2026-10-23", end_date: "2026-10-24", requester_id: "s1", target_id: "s2", status: "accepted", manager_approved: true, track: "supervisor" }], "supervisor")).toEqual(["s2"]); });
  it("requires colleagues to be free throughout the range", () => { expect(freeForRange("s2", "2026-10-23", "2026-10-25", supervisor, [], "supervisor")).toBe(false); });
  it("rejects people from the wrong role pool", () => { expect(validRota({ ...supervisor, order: ["t1"] }, ["s1", "s2"])).toBe(false); });
  it("caps staffing at selected members", () => { expect(validRota({ ...supervisor, perShift: 3 }, ["s1", "s2", "s3"])).toBe(false); });
  it("permits clearing a track without deleting evidence", () => { expect(validRota({ ...supervisor, order: [] }, ["s1", "s2"])).toBe(true); });
});
describe("custom rotation and membership", () => {
  it.each([2,4,5,10])("accepts %i-day cycles", days => expect(validRota({...tech,rotationDays:days},["t1","t2"])).toBe(true));
  it("cycles every four days from its date anchor", () => { const cfg={...tech,rotationDays:4}; expect(rotaFor("2026-10-26",cfg,[],"technician")).toEqual(["t1"]); expect(rotaFor("2026-10-27",cfg,[],"technician")).toEqual(["t2"]); });
  it("anchors only weekly multiples", () => { expect(weeklyRota(7)).toBe(true); expect(weeklyRota(14)).toBe(true); expect(weeklyRota(4)).toBe(false); });
  it("excludes terminated technicians", () => expect(activeRotaMember({role:"technician",registration_status:"terminated"},"technician")).toBe(false));
  it("retains active technicians", () => expect(activeRotaMember({role:"technician",registration_status:"active"},"technician")).toBe(true));
});
