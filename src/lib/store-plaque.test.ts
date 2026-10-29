import { describe, expect, it } from "vitest";
import { defaultPlaqueMessages, PLAQUE_SIZES } from "./store-plaque";

describe("plaque paper formats", () => {
  it.each([
    ["a6", 105, 148], ["a5", 148, 210], ["a4", 210, 297], ["a3", 297, 420],
  ] as const)("keeps %s portrait paper dimensions", (size, width, height) => {
    expect(PLAQUE_SIZES[size].width).toBe(width);
    expect(PLAQUE_SIZES[size].height).toBe(height);
  });
  it("keeps message drafts independent", () => {
    const first = defaultPlaqueMessages();
    first.headline.text = "Report a fault";
    expect(defaultPlaqueMessages().headline.text).not.toBe(first.headline.text);
  });
});