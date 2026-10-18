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
