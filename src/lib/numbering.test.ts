import { describe, expect, it } from "vitest";
import { formatDocumentNumber } from "./numbering";

describe("document numbering", () => {
  it("continues from the chosen start number with padding", () => {
    expect(formatDocumentNumber({ prefix: "EST-", padding: 4, next: 1051 })).toBe("EST-1051");
    expect(formatDocumentNumber({ prefix: "INV-", padding: 6, next: 42 })).toBe("INV-000042");
  });
  it("uses the separate fixed quote prefix", () => expect(formatDocumentNumber({ prefix: "QUO-", padding: 4, next: 1 })).toBe("QUO-0001"));
  it("never cuts digits when the number outgrows the padding", () => {
    expect(formatDocumentNumber({ prefix: "JS", padding: 3, next: 12345 })).toBe("JS12345");
  });
});
