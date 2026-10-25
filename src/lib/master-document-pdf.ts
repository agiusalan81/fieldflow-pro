import { masterDocumentLines, type MasterDocumentContent } from "./master-document";
import type { Audience } from "./document-audience";

export async function buildMasterDocumentPdf(doc: MasterDocumentContent, view: Audience, company: { name?: string; logo?: string } = {}) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (text: string) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/×/g, "x").replace(/[^\x0A\x20-\x7E\xA0-\xFF€•]/g, "?");
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | undefined;
  try {
    if (company.logo?.startsWith("data:image/png")) logo = await pdf.embedPng(company.logo);
    else if (company.logo?.startsWith("data:image/jp")) logo = await pdf.embedJpg(company.logo);
  } catch { logo = undefined; }
  const addPage = () => {
    const page = pdf.addPage([595, 842]);
    if (logo) { const scale = Math.min(100 / logo.width, 30 / logo.height); page.drawImage(logo, { x: 42, y: 778, width: logo.width * scale, height: logo.height * scale }); }
    if (company.name) page.drawText(safe(company.name).slice(0, 75), { x: logo ? 155 : 42, y: 790, size: 11, font: bold });
    page.drawText(`${view === "client" ? "Client" : "Technician"} copy · ${pdf.getPageCount()}`, { x: 42, y: 30, size: 8, font });
    return page;
  };
  let page = addPage(), y = 748;
  masterDocumentLines(doc, view).forEach((text, index) => {
    const size = index === 0 ? 15 : 10;
    const face = index === 0 ? bold : font;
    for (const paragraph of safe(text).split("\n")) {
      let line = "";
      const draw = () => { if (y < 60) { page = addPage(); y = 748; } page.drawText(line, { x: 42, y, size, font: face }); y -= size + 5; line = ""; };
      // Wrap long unbroken words as well as normal text.
      for (const character of paragraph) {
        if (face.widthOfTextAtSize(line + character, size) > 511) draw();
        line += character;
      }
      draw();
    }
    y -= 8;
  });
  return pdf.save();
}