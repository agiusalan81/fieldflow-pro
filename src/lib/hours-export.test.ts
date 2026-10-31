import { describe, expect, it } from "vitest";
import { hoursCsv } from "./hours-export";

const base = { report_date: "2026-10-01", shift_start: null, shift_end: null, break_minutes: 30, worked_hours: 9, standard_hours: 8, ot15_hours: 1, ot20_hours: 0, users: { full_name: "=Jo", employee_id: "E1" } };

describe("hoursCsv", () => {
  it("exports hours and overtime per report", () => {
    const line = hoursCsv([base]).split("\r\n")[1];
    expect(line).toContain('"8","1","0"');
    expect(line).toContain('"\'=Jo"');
  });
  it("skips superseded reports so hours are not doubled", () => {
    expect(hoursCsv([{ ...base, superseded_by: "x" }]).split("\r\n")).toHaveLength(1);
  });
});
