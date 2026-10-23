import { expect, it } from "vitest";
import { BRAND_FONTS } from "./brand-fonts";
import { parseTemplate } from "./documents";
import { documentFontSource } from "./branding-assets";

it("offers at least 50 unique asset-backed fonts that survive saved template parsing", () => {
  expect(BRAND_FONTS.length).toBeGreaterThanOrEqual(50);
  expect(new Set(BRAND_FONTS.map(f => f.value)).size).toBe(BRAND_FONTS.length);
  for (const font of BRAND_FONTS) {
    const template = parseTemplate({ documentFont: font.value });
    expect(template.documentFont).toBe(font.value);
    expect(documentFontSource(template)).toBe(font.source);
    expect(font.source).toMatch(/^\/__l5e\/assets-v1\//);
  }
});