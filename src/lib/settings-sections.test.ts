import { describe, expect, it } from "vitest";
import { settingsSectionPatch } from "./settings-sections";

describe("independent settings saves", () => {
  const values = { terms: { job_sheet: "New terms" }, note_presets: ["New note"], pdf_template: { footer: "Old footer" }, theme: { headers: "Old font" }, company_email: "new@example.com", app_title: "New title", vat_number: "MT123" };
  it("saving terms never overwrites PDF styling", () => {
    expect(settingsSectionPatch("terms", values)).toEqual({ terms: { job_sheet: "New terms" }, note_presets: ["New note"] });
  });
  it("saving PDF styling never overwrites terms or notes", () => {
    expect(settingsSectionPatch("branding", values)).toEqual({ pdf_template: { footer: "Old footer" } });
  });
  it("saving company details never overwrites fonts", () => {
    expect(settingsSectionPatch("details", values)).toEqual({ company_email: "new@example.com", app_title: "New title", vat_number: "MT123" });
  });
  it("saving fonts never overwrites company details", () => {
    expect(settingsSectionPatch("fonts", values)).toEqual({ theme: { headers: "Old font" } });
  });
});