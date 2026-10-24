import { describe, it, expect } from "vitest";
import { handoverChoices } from "./member-handover";
const jobs = [{ id: "job-1", number: 1, date: "2026-10-24", summary: null, slot: "lead" }];
describe("termination work handover", () => {
  it("requires a decision for every scheduled job", () => expect(() => handoverChoices(jobs, {})).toThrow());
  it("returns an unfilled vacancy to office dispatch", () => expect(handoverChoices(jobs, { "job-1": "dispatch" })).toEqual([{ jobId: "job-1", replacement: null }]));
  it("preserves the chosen replacement", () => expect(handoverChoices(jobs, { "job-1": "active-tech" })).toEqual([{ jobId: "job-1", replacement: "active-tech" }]));
});