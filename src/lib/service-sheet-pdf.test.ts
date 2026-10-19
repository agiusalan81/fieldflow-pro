import { it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DEFAULT_TEMPLATE } from "./documents";
import { buildServicePdf } from "./service-sheet-pdf";

it("creates a readable multipage service report for long actual work records", async () => {
  const bytes = await buildServicePdf({ company: "Test Company", officeAddress: "Building 1, Main Street", vatNumber: "123", contact: "Office", number: "1042", date: "19/10/2026", client: "Client", address: "Site", asset: "Unit 2", fault: "Reported fault", repairs: "Completed repairs", technician: "Alan Agius", signedBy: "Client Name", idCard: "", signature: null, logs: Array.from({ length: 70 }, () => ({ date: "2026-10-19", in: "08:00", out: "10:00", travel: 0.5, total: 2, techs: "AA", count: 1 })), parts: [{ desc: "LongPart".repeat(100), unit: "pcs", qty: 1 }], notes: null, terms: "Keep a copy.\nPayment terms.", template: { ...DEFAULT_TEMPLATE, stylePreset: "service" } });
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  expect(pdf.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
});