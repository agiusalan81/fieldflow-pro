import { describe, it, expect } from "vitest";
import { appearanceCss, mergeAppearance, defaultAppearance } from "./product-appearance";

describe("product appearance", () => {
  it("hotel defaults: white fields, dark navy titles, lighter blue entries", () => {
    const a = defaultAppearance("hotel");
    expect(a.palette.fieldBackground).toBe("#ffffff");
    expect(a.zones.fieldTitle.color).toBe("#0f2942");
    expect(a.zones.fieldText.color).toBe("#3b82f6");
  });
  it("css is scoped to its edition and applies bold/italic", () => {
    const a = mergeAppearance("retail", { zones: { fieldTitle: { bold: true, italic: true, color: "#111111" } } });
    const css = appearanceCss("retail", a);
    expect(css).toContain('html[data-edition="retail"]');
    expect(css).not.toContain('data-edition="hotel"');
    expect(css).toMatch(/font-weight:700;font-style:italic/);
  });
  it("rejects non-hex colours", () => {
    const a = mergeAppearance("retail", { palette: { primary: "red;}body{display:none" } });
    expect(appearanceCss("retail", a)).not.toContain("display:none");
  });
});
