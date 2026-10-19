import { describe, it, expect } from "vitest";
import { canDecideLeave, missingProfileFields, unfinishedJobs, nextDay } from "@/lib/field-rules";

describe("leave approval routing", () => {
  it("supervisor approves technician leave", () => expect(canDecideLeave("supervisor", "technician", false)).toBe(true));
  it("supervisor cannot approve another supervisor's leave", () => expect(canDecideLeave("supervisor", "supervisor", false)).toBe(false));
  it("office admin approves supervisor leave", () => expect(canDecideLeave("admin", "supervisor", false)).toBe(true));
  it("nobody but a superuser decides own leave", () => { expect(canDecideLeave("admin", "admin", true)).toBe(false); expect(canDecideLeave("superuser", "superuser", true)).toBe(true); });
});

describe("required personal details", () => {
  it("lists every missing required field", () => expect(missingProfileFields({ phone_number: null, home_address: "", next_of_kin_1: {} })).toEqual(["Mobile phone", "Home address", "Next of kin name", "Next of kin relationship", "Next of kin phone"]));
  it("complete profile passes; next of kin 2 optional", () => expect(missingProfileFields({ phone_number: "+356 79123456", home_address: "1 Main St", next_of_kin_1: { name: "A", relationship: "Wife", phone: "+356 79000000" } })).toEqual([]));
});

describe("unfinished work at clock-out", () => {
  it("keeps jobs without a completed sheet", () => expect(unfinishedJobs([{ id: "a" }, { id: "b" }, { id: "c" }], [{ job_id: "a", status: "completed" }, { job_id: "b", status: "in_progress" }]).map((j) => j.id)).toEqual(["b", "c"]));
  it("rolls to the next day", () => expect(nextDay("2026-12-31")).toBe("2027-01-01"));
});
