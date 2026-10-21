import { describe, it, expect } from "vitest";
import { normalizePlate, validPlate, formatPlate } from "@/lib/dwr";
describe("vehicle plate", () => {
 it("accepts fleet format ABC 123",()=>{expect(validPlate("ABC 123")).toBe(true);expect(normalizePlate("ABC 123")).toBe("ABC123");});
  it("accepts 3 letters + 3 numbers", () => { expect(validPlate("abc 123")).toBe(true); expect(normalizePlate("abc-123")).toBe("ABC123"); });
  it("rejects other formats", () => { expect(validPlate("AB1234")).toBe(false); expect(validPlate("ABCD12")).toBe(false); expect(validPlate("AB123")).toBe(false); });
  it("formats with a space", () => expect(formatPlate("ABC123")).toBe("ABC 123"));
});
