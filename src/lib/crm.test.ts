import { describe, expect, it } from "vitest";
import { canConvert, defaultDue, followupState, mergeActions, needsAttention, pipelineTotals, DEFAULT_ACTIONS } from "./crm";
import { moduleCategory, moduleLayer } from "./module-categories";

describe("crm rules", () => {
  it("ships the seven default follow-up actions", () => {
    expect(DEFAULT_ACTIONS.map((a) => a.label)).toEqual(["Phone call", "WhatsApp message", "Site inspection", "Send quote", "Revise quote", "In-person meeting", "Tender submission"]);
  });
  it("adds custom actions and hides archived ones", () => {
    const all = mergeActions([{ id: "a", label: "Lift survey", icon: "map", due_hours: 6, archived: false }, { id: "b", label: "Old", icon: "phone", due_hours: 1, archived: true }]);
    expect(all).toHaveLength(8);
    expect(all.at(-1)).toMatchObject({ key: "custom:a", label: "Lift survey", dueHours: 6 });
  });
  it("defaults due time to the action offset rounded to 15 minutes", () => {
    expect(defaultDue({ dueHours: 24 }, new Date("2026-10-26T09:07:00Z")).toISOString()).toBe("2026-10-27T09:15:00.000Z");
  });
  it("flags overdue and due-today follow-ups for the bell, not done or future ones", () => {
    const now = new Date(2026, 9, 26, 10, 0);
    expect(followupState({ due_at: new Date(2026, 9, 26, 9, 0).toISOString(), done_at: null }, now)).toBe("overdue");
    expect(needsAttention({ due_at: new Date(2026, 9, 26, 18, 0).toISOString(), done_at: null }, now)).toBe(true);
    expect(needsAttention({ due_at: new Date(2026, 9, 28, 9, 0).toISOString(), done_at: null }, now)).toBe(false);
    expect(needsAttention({ due_at: new Date(2026, 9, 25).toISOString(), done_at: "2026-10-25T10:00:00Z" }, now)).toBe(false);
  });
  it("needs a client before converting to a job and never converts twice", () => {
    expect(canConvert("job", { client_id: null, quote_id: null, job_id: null })).toBe(false);
    expect(canConvert("job", { client_id: "c", quote_id: null, job_id: null })).toBe(true);
    expect(canConvert("quote", { client_id: "c", quote_id: "q", job_id: null })).toBe(false);
  });
  it("totals value per stage", () => {
    expect(pipelineTotals([{ stage: "new", value: 100 }, { stage: "new", value: null }, { stage: "won", value: 50 }]).new).toEqual({ count: 2, value: 100 });
  });
  it("is a horizontal Clients & Commercial module", () => {
    expect(moduleLayer("crm_pipeline")).toBe("horizontal");
    expect(moduleCategory("crm_pipeline")).toBe("Clients & Commercial");
  });
});
