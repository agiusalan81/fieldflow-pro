import { describe, expect, it } from "vitest";
import { defaultCopyView, fitsAttachment, learnedOptions, missingTags } from "./document-library-tags";

describe("document library tags", () => {
  it("opens a technician-only copy on the technician view (no blank client preview)", () => {
    expect(defaultCopyView(["technician"])).toBe("technician");
    expect(defaultCopyView(["client"])).toBe("client");
  });
  it("learns new contract types once, case-insensitively", () => {
    expect(learnedOptions(["New sale"], ["new sale", "Council tender", "Council tender"])).toEqual(["New sale", "Council tender"]);
  });
  it("requires a contract type before saving a contract", () => {
    expect(missingTags({ kind: "contract", contract_type: "", sector: "all" })).toEqual(["Contract type"]);
    expect(missingTags({ kind: "risk assessment", sector: "commercial" })).toEqual([]);
  });
  it("offers only technician copies for equipment and only client copies for agreements", () => {
    expect(fitsAttachment(["client"], "field")).toBe(false);
    expect(fitsAttachment(["technician"], "field")).toBe(true);
    expect(fitsAttachment(["technician"], "client")).toBe(false);
  });
});
