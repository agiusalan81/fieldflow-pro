import { describe, it, expect } from "vitest";
import { addChoice } from "./field-documents";
import { parseTextStyles } from "./documents";
import { companyTitle } from "./company-name";
import { ACCOUNTING, ACCOUNTING_GUIDES } from "./integrations";

describe("suggestions, button backgrounds and personal naming", () => {
  it("suggestion adds once, ignoring case", () => { expect(addChoice("Otis, Kone", "otis")).toBe("Otis, Kone"); expect(addChoice("Otis", "Schindler")).toBe("Otis, Schindler"); });
  it("field heading button background is kept, unsafe values dropped", () => { expect(parseTextStyles({ label: { background: "#123456" } }).label.background).toBe("#123456"); expect(parseTextStyles({ label: { background: "url(x)" } }).label.background).toBe(""); });
  it("library is named after the company", () => { expect(companyTitle("Minakel", "document library")).toBe("Minakel document library"); expect(companyTitle("", "document library")).toBe("Document library"); });
  it("every accounting choice has a connection guide", () => { for (const a of ACCOUNTING) expect(ACCOUNTING_GUIDES[a.key].steps.length).toBeGreaterThan(0); });
});
