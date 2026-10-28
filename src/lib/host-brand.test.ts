import { describe, expect, it } from "vitest";
import { brandForHost } from "./host-brand";

describe("brandForHost", () => {
  it("aisleopsapp.com shows supermarket branding", () => expect(brandForHost("aisleopsapp.com")).toBe("retail"));
  it("www.aisleopsapp.com shows supermarket branding", () => expect(brandForHost("www.aisleopsapp.com")).toBe("retail"));
  it("fieldbridgeapp.com stays FieldBridge", () => expect(brandForHost("fieldbridgeapp.com")).toBe("fieldbridge"));
});
