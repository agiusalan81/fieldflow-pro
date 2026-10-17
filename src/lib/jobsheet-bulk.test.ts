import { describe, expect, it } from "vitest";
import { labourHours, technicianCount, matchesSheetDetails, validateCombinedSheets } from "./jobsheets";

describe("job-sheet staffing and bulk rules", () => {
  it("two hours on site with two technicians gives four labour hours", () => expect(labourHours("08:00", "10:00", 2)).toBe(4));
  it("count cannot omit selected technicians", () => expect(technicianCount(1, ["AA", "JG"])).toBe(2));
  const row = { created_at: "2026-10-17T10:00:00Z", client_id: "client", assigned_technician_id: "lead", jobsheet_time_logs: [{ technician_initials: ["JG"] }] };
  it("date boundaries include the complete end day", () => expect(matchesSheetDetails(row, { from: "2026-10-17", to: "2026-10-17", client: "all", technician: "all" })).toBe(true));
  it("date range excludes earlier sheets", () => expect(matchesSheetDetails(row, { from: "2026-10-18", to: "", client: "all", technician: "all" })).toBe(false));
  it("customer filter excludes another customer", () => expect(matchesSheetDetails(row, { from: "", to: "", client: "other", technician: "all" })).toBe(false));
  it("technician filter includes assistants by initials", () => expect(matchesSheetDetails(row, { from: "", to: "", client: "all", technician: "assistant", initials: "JG" })).toBe(true));
  it("technician filter excludes uninvolved technicians", () => expect(matchesSheetDetails(row, { from: "", to: "", client: "all", technician: "other", initials: "ZZ" })).toBe(false));
  it("combined PDF accepts multiple completed sheets for the customer", () => expect(() => validateCombinedSheets([{ client_id: "a", status: "completed" }, { client_id: "a", status: "completed" }])).not.toThrow());
  it("combined PDF excludes drafts", () => expect(() => validateCombinedSheets([{ client_id: "a", status: "draft" }])).toThrow());
  it("combined PDF prevents mixing customers", () => expect(() => validateCombinedSheets([{ client_id: "a", status: "completed" }, { client_id: "b", status: "completed" }])).toThrow());
});