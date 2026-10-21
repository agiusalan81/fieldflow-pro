import { describe, it, expect } from "vitest";
import { contrastRatio, parseAppearance, brandPath, industrySheetLabel } from "./branding";
import { parseTemplate } from "./documents";
describe("tenant branding", () => {
  it("rejects external and cross-purpose file references", () => { expect(brandPath("https://external.test/a.ttf")).toBe(""); expect(parseTemplate({fontPath:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/backgrounds/a.jpg"}).fontPath).toBe(""); });
  it("retains saved customisation for read-only downgraded companies", () => { expect(parseTemplate({frame:"double", documentFont:"lato", fieldBackground:"#ffffff",fieldText:"#202020"})).toMatchObject({frame:"double",documentFont:"lato",fieldText:"#202020"}); });
  it("rejects unsafe field colours and icon sets", () => { expect(parseAppearance({fieldText:"url(evil)",iconPreset:"script"})).toMatchObject({fieldText:"",iconPreset:"outline"}); });
  it("requires at least 4.5 contrast for readable field pairs", () => { expect(contrastRatio("#ffffff","#202020")).toBeGreaterThanOrEqual(4.5); expect(contrastRatio("#ffffff","#eeeeee")).toBeLessThan(4.5); });
  it("industry presets change wording without adding menu entries", () => { expect(industrySheetLabel("hvac","Job sheets")).toBe("HVAC service sheets"); expect(industrySheetLabel("hvac","Team")).toBe("Team"); });
  it("lifts companies keep the menu entry named Job sheets", () => { expect(industrySheetLabel("lifts","Job sheets")).toBe("Job sheets"); expect(industrySheetLabel("lifts","job sheets pending")).toBe("job sheets pending"); });
});