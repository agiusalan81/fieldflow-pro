import { describe, expect, it } from "vitest";
import { masterDocumentLines } from "./master-document";
import { DEFAULT_LIFT_PRICING } from "./document-blocks";
import { buildMasterDocumentPdf } from "./master-document-pdf";
const doc = { name: "Maintenance", body: "Scope of works", kind: "checklist", items: ["Locks"], commercial: { basePrice: 500, showSampleCalculation: true, liftPricing: { ...DEFAULT_LIFT_PRICING, stops: 6, landingDoors: 4, carAccess: 2, extraStopRate: 25, landingDoorRate: 30, extraCarDoorRate: 45 } } };
describe("master document export", () => {
  it.each(["contract", "reference", "terms", "sop", "checklist"])("%s documents retain checklist readings/photos and hide technician prices", (kind) => {
    const draft = { name: "Audit", body: "", kind, items: ["Pressure", "Private check", "Client fee"], field_specs: [{ control: "reading", unit: "bar", audience: "both", photo: true, price: 15 }, { audience: "technician" }, { audience: "client" }] };
    const tech = masterDocumentLines(draft, "technician").join("\n");
    const client = masterDocumentLines(draft, "client").join("\n");
    expect(tech).toContain("Pressure   ________ bar   [Photo]");
    expect(tech).toContain("Private check");
    expect(tech).not.toContain("Client fee");
    expect(tech).not.toContain("€15.00");
    expect(client).toContain("• Pressure   €15.00");
    expect(client).not.toContain("Private check");
    expect(client).not.toContain("[Photo]");
  });
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
import { rowsFromText, specChoices, parseFieldSpecs as pfs } from "./document-blocks";
import { customerNotes } from "./service-sheet";
describe("checklist text and choices", () => {
  it("each typed line becomes a row and keeps earlier row settings", () => {
    const r = rowsFromText("A\nB", [{ control: "reading", audience: "both", unit: "bar" }]);
    expect(r.items).toEqual(["A", "B"]);
    expect(r.specs[0]!.control).toBe("reading");
    expect(r.specs[1]!.audience).toBe("both");
  });
  it("custom choices default to Done / Satisfactory / N/A and persist", () => {
    expect(specChoices({ control: "choice", audience: "both", unit: "" })).toEqual(["Done", "Satisfactory", "N/A"]);
    expect(pfs([{ control: "choice", options: ["Done", "Faulty"] }], 1)[0]!.options).toEqual(["Done", "Faulty"]);
  });
  it("maintenance notes always reach the customer copy", () => {
    expect(customerNotes("Ropes lubricated", null)).toBe("Maintenance notes:\nRopes lubricated");
    expect(customerNotes("", "")).toBeNull();
  });
});
