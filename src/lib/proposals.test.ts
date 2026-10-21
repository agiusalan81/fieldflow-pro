import { describe, it, expect } from "vitest";
import { parseTerms, proposalTotals, visibleSections } from "./proposals";

describe("proposals", () => {
  it("has exactly four payment term lines by default", () => expect(parseTerms({}).payment).toHaveLength(4));
  it("keeps four lines even when fewer are saved", () => expect(parseTerms({ payment: ["50%"] }).payment).toEqual(["50%", "", "", ""]));
  it("hydraulic lifts show hydraulic equipment, not drive", () => {
    const keys = visibleSections({ equipment_subtype: "Hydraulic" }, "elevator").map((s) => s.key);
    expect(keys).toContain("hydraulic"); expect(keys).not.toContain("drive");
  });
  it("MRL lifts show drive equipment", () => expect(visibleSections({ equipment_subtype: "Electric MRL" }, "elevator").map((s) => s.key)).toContain("drive"));
  it("lift net €50,000 at 18% VAT totals €59,000", () => expect(proposalTotals([], { offer_net: "50000", offer_vat: "18" })).toEqual({ net: 50000, vat: 9000, total: 59000 }));
  it("optional alternatives are not added to the offer", () => {
    const t = proposalTotals([{ id: "a", category: "", name: "Door finish", unit: "each", quantity: 1, rate: 500, vat: 18, optional: true }, { id: "b", category: "", name: "T", unit: "each", quantity: 5, rate: 10, vat: 18 }], { offer_net: "", offer_vat: "18" });
    expect(t).toEqual({ net: 50, vat: 9, total: 59 });
  });
});
