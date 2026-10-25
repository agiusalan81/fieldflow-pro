import { describe, expect, it } from "vitest";
import { masterDocumentLines } from "./master-document";
import { DEFAULT_LIFT_PRICING } from "./document-blocks";
import { buildMasterDocumentPdf } from "./master-document-pdf";
const doc = { name: "Maintenance", body: "Scope of works", kind: "checklist", items: ["Locks"], commercial: { basePrice: 500, showSampleCalculation: true, liftPricing: { ...DEFAULT_LIFT_PRICING, stops: 6, landingDoors: 4, carAccess: 2, extraStopRate: 25, landingDoorRate: 30, extraCarDoorRate: 45 } } };
describe("master document export", () => {
  it("excludes all structured commercial data from technician copies", () => {
    const output = masterDocumentLines(doc, "technician").join("\n");
    expect(output).toContain("Locks");
    expect(output).not.toContain("€");
    expect(output).not.toContain("sample calculation");
  });
  it("exports the requested base price and 765 euro sample calculation", () => {
    const output = masterDocumentLines(doc, "client").join("\n");
    expect(output).toContain("Base price: €500.00");
    expect(output).toContain("1 × €500.00 + 4 × €25.00 + 4 × €30.00 + 1 × €45.00 = €765.00");
  });
  it("can hide the sample while retaining the compound total", () => {
    const output = masterDocumentLines({ ...doc, commercial: { ...doc.commercial, showSampleCalculation: false } }, "client").join("\n");
    expect(output).not.toContain("4 × €25.00");
    expect(output).toContain("Total: €765.00");
  });
  it("produces a PDF for the selected copy", async () => {
    const pdf = await buildMasterDocumentPdf(doc, "client", { name: "Test company" });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});