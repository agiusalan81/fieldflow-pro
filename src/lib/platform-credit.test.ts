import { describe, expect, it } from "vitest";
import { letterheadContact, platformCredit } from "./platform-credit";

describe("platform credit", () => {
  it("names the product per edition", () => {
    expect(platformCredit("retail")).toContain("AisleOps");
    expect(platformCredit("hotel")).toContain("FieldBridge Hotels");
    expect(platformCredit()).toBe("Generated with FieldBridge · fieldbridgeapp.com");
  });
  it("drops empty contact values", () => {
    expect(letterheadContact({ address: "Valletta", phone: "", email: "a@b.mt" })).toEqual(["Valletta", "a@b.mt"]);
  });
});
