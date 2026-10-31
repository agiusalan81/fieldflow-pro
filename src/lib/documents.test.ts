import { describe, expect, it } from "vitest";
import { DEFAULT_TERMS, moveBlock, parseTemplate, termsFor, visibleBlocks, documentLabel, DEFAULT_TEMPLATE } from "./documents";

describe("pdf template", () => {
  it("shares company wording between entry and documents", () => { expect(documentLabel(parseTemplate({ labels: { equipment: "Chiller Unit" } }), "equipment")).toBe("Chiller Unit"); });
  it("rejects unsafe colour and label values", () => { const t = parseTemplate({ primaryColor: "url(evil)", labels: { equipment: 1 } }); expect(t.primaryColor).toBe(DEFAULT_TEMPLATE.primaryColor); expect(documentLabel(t, "equipment")).toBe("Equipment"); });
  it("hidden blocks are not printed", () => {
    const t = parseTemplate({ order: ["work", "client"], hidden: ["client"] });
    expect(visibleBlocks(t)[0]).toBe("work");
    expect(visibleBlocks(t)).not.toContain("client");
  });
  it("keeps blocks missing from a stored order", () => {
    expect(parseTemplate({ order: ["parts"] }).order).toContain("signoff");
  });
  it("drag reorders blocks", () => {
    expect(moveBlock(["client", "work", "parts"], 2, 0)).toEqual(["parts", "client", "work"]);
  });
});

describe("terms & conditions", () => {
  it("only print when switched on for that document type", () => {
    const t = { ...DEFAULT_TERMS, job_sheet: { enabled: false, text: "Pay in 30 days" }, estimate: { enabled: true, text: "Valid 30 days" } };
    expect(termsFor(t, "job_sheet")).toBeNull();
    expect(termsFor(t, "estimate")).toBe("Valid 30 days");
  });
});

import { parseTemplate as parseT, layerColor } from "./documents";
describe("document text layers", () => {
  it("keeps separate company, heading and detail styles", () => {
    const t = parseT({ textStyles: { company: { font: "serif", color: "#112233", bold: true, italic: true }, detail: { italic: true } } });
    expect(t.textStyles?.company).toEqual({ font: "serif", color: "#112233", bold: true, italic: true, underline: false, background: "" });
    expect(t.textStyles?.label.bold).toBe(true);
    expect(t.textStyles?.detail.italic).toBe(true);
  });
  it("headings default to the brand colour", () => { const t = parseT({ primaryColor: "#abcdef" }); expect(layerColor(t, "label")).toBe("#abcdef"); });
  it("company name defaults to its brand colour even with white field text", () => { expect(layerColor(parseT({ primaryColor: '#246654', fieldText: '#ffffff' }), 'company')).toBe('#246654'); });
  it('repairs white company lettering on a white document', () => { expect(layerColor(parseT({ primaryColor: '#e86711', fieldBackground: '#ffffff', textStyles: { company: { color: '#ffffff' } } }), 'company')).toBe('#e86711'); });
  it("keeps named fonts independently selectable by every layer", () => { const t = parseT({ customFonts: [{ id: 'brand-bold', name: 'Brand Bold', path: '00000000-0000-4000-8000-000000000001/fonts/a.ttf' }], textStyles: { company: { font: 'custom:brand-bold' }, label: { font: 'custom:brand-bold' }, detail: { font: 'custom:brand-bold' } } }); expect(t.customFonts?.[0]?.name).toBe('Brand Bold'); for (const key of ['company', 'label', 'detail'] as const) expect(t.textStyles?.[key].font).toBe('custom:brand-bold'); });
  it("retains transparent grayscale backgrounds with adjustable brightness", () => { const t = parseT({ backgroundOpacity: .35, backgroundTone: 'grayscale', backgroundBrightness: 1.5 }); expect(t.backgroundOpacity).toBe(.35); expect(t.backgroundTone).toBe('grayscale'); expect(t.backgroundBrightness).toBe(1.5); });
});

it("retains underline only when explicitly enabled", () => { expect(parseTemplate({textStyles:{company:{underline:true},detail:{underline:"yes"}}}).textStyles?.company.underline).toBe(true); expect(parseTemplate({textStyles:{detail:{underline:"yes"}}}).textStyles?.detail.underline).toBe(false); });
