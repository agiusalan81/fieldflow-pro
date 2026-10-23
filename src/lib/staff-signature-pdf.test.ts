import { it, expect } from "vitest";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { buildPdf } from "./sendJobSheetEmail";
import { DEFAULT_TEMPLATE } from "./documents";
it("embeds a staff signature without substituting client consent in every PDF style", async () => {
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  for (const stylePreset of ["service", "classic", "compact", "bold", "technical"] as const) {
    const bytes = await buildPdf({ company: "Test", number: "1", date: "23/10/2026", client: "Test client", address: "Test site", asset: "Lift 1", fault: "Fault", repairs: "Work", technician: "Test technician", technicianSignature: pixel, signedBy: "", idCard: "", signature: null, logs: [], parts: [], notes: null, terms: null, template: { ...DEFAULT_TEMPLATE, stylePreset } });
    const pdf = await PDFDocument.load(bytes);
    const images = pdf.getPages().flatMap(page => {
      const resources = page.node.Resources(); const objects = resources?.lookup(PDFName.of("XObject"), PDFDict);
      return objects?.keys() ?? [];
    });
    expect(images.length).toBe(1);
  }
});