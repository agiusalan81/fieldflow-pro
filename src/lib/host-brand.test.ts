import { describe, expect, it } from "vitest";
import { brandForHost } from "./host-brand";

describe("brandForHost", () => {
  it("aisleopsapp.com shows supermarket branding", () => expect(brandForHost("aisleopsapp.com")).toBe("retail"));
  it("www.aisleopsapp.com shows supermarket branding", () => expect(brandForHost("www.aisleopsapp.com")).toBe("retail"));
  it("fieldbridgehotels.com shows hotel branding", () => expect(brandForHost("fieldbridgehotels.com")).toBe("hotels"));
  it("www.fieldbridgehotels.com shows hotel branding", () => expect(brandForHost("www.fieldbridgehotels.com")).toBe("hotels"));
  it("suiteopsapp.com shows hotel branding", () => expect(brandForHost("suiteopsapp.com")).toBe("hotels"));
  it("fieldbridgeapp.com stays FieldBridge", () => expect(brandForHost("fieldbridgeapp.com")).toBe("fieldbridge"));
});
