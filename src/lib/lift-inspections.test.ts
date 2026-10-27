import { describe, expect, it } from "vitest";
import { inspectionStatus } from "./lift-inspections";

const today = new Date(2026, 9, 27);
describe("inspection due status", () => {
  it("is overdue after the due date", () => expect(inspectionStatus("2026-10-26", today)).toBe("overdue"));
  it("is due soon within 30 days", () => expect(inspectionStatus("2026-11-26", today)).toBe("due_soon"));
  it("is fine beyond 30 days", () => expect(inspectionStatus("2026-11-27", today)).toBe("ok"));
  it("is unscheduled without a date", () => expect(inspectionStatus(null, today)).toBe("unscheduled"));
});
