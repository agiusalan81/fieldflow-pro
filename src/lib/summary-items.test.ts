import { describe, expect, it } from "vitest";
import { hasCommercial, parseCommercial, summaryItemsFromText, summaryItemsToText } from "./document-blocks";
describe("summary items", () => {
  it("parses [Tag] prefix and :: suffix subtags", () => {
    expect(summaryItemsFromText("[Included] Annual safety certification\n24/7 callout :: Coverage\n\nPlain row")).toEqual([
      { tag: "Included", text: "Annual safety certification" }, { tag: "Coverage", text: "24/7 callout" }, { tag: "", text: "Plain row" }]);
  });
  it("round-trips and counts as commercial content", () => {
    const items = [{ tag: "SLA", text: "4h response" }];
    expect(summaryItemsFromText(summaryItemsToText(items))).toEqual(items);
    expect(hasCommercial(parseCommercial({ summaryItems: items }))).toBe(true);
  });
});
