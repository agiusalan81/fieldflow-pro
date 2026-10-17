import { describe, it, expect } from "vitest";
import { matchesSheetFilter } from "./jobsheets";

const a = { status: "completed", requires_admin_approval: true, pending_works_future_jobs: null };
const p = { status: "pending", requires_admin_approval: false, pending_works_future_jobs: "Replace rope" };
const n = { status: "pending", requires_admin_approval: false, pending_works_future_jobs: "  " };

describe("matchesSheetFilter", () => {
  it("needs asset approval only matches flagged sheets", () => {
    expect([a, p, n].filter((j) => matchesSheetFilter(j, "needs_approval"))).toEqual([a]);
  });
  it("has pending works ignores blank notes", () => {
    expect([a, p, n].filter((j) => matchesSheetFilter(j, "has_pending"))).toEqual([p]);
  });
  it("admin queue matches either", () => {
    expect([a, p, n].filter((j) => matchesSheetFilter(j, "admin_queue"))).toEqual([a, p]);
  });
  it("status filter matches status", () => {
    expect([a, p, n].filter((j) => matchesSheetFilter(j, "pending"))).toEqual([p, n]);
  });
});
