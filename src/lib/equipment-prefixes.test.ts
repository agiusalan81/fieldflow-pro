import { describe, expect, it } from "vitest";
import { derivePrefix, prefixFor, sequenceTags } from "./equipment-prefixes";

describe("equipment prefixes", () => {
  it("three fridges become FR-01, FR-02, FR-03", () => {
    expect(sequenceTags(["FR", "FR", "FR"], [], "-", 2)).toEqual(["FR-01", "FR-02", "FR-03"]);
  });
  it("continues after existing tags per prefix", () => {
    expect(sequenceTags(["FR", "AC"], ["FR-03", "AC-01"], "-", 2)).toEqual(["FR-04", "AC-02"]);
  });
  it("uses industry defaults per app", () => {
    expect(prefixFor("Escalator", "contractor")).toBe("ESC");
    expect(prefixFor("Oven", "retail")).toBe("OV");
    expect(prefixFor("Safe", "hotel")).toBe("SF");
  });
  it("tenant override wins over the default", () => {
    expect(prefixFor("Fridge", "hotel", { fridge: "REF" })).toBe("REF");
  });
  it("derives a prefix for unlisted equipment", () => {
    expect(derivePrefix("Bake-off rotary oven")).toBe("BOR");
    expect(prefixFor("Ice cream cabinet", "hotel")).toBe("ICC");
  });
});
