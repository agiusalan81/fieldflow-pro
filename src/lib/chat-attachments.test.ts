import { describe, it, expect } from "vitest";
import { chatFileError, contactVcard, parseChatFiles, validContactCard, MAX_CHAT_BYTES } from "./chat-attachments";
describe("private chat attachments", () => {
  it("accepts photos and PDF documents", () => { expect(chatFileError({ size: 100, type: "image/jpeg" }, 0)).toBeNull(); expect(chatFileError({ size: 100, type: "application/pdf" }, 0)).toBeNull(); });
  it("rejects executable and HTML uploads", () => { expect(chatFileError({ size: 100, type: "text/html" }, 0)).not.toBeNull(); });
  it("limits files to 20 MB", () => { expect(chatFileError({ size: MAX_CHAT_BYTES + 1, type: "image/jpeg" }, 0)).not.toBeNull(); });
  it("limits messages to five files", () => { expect(chatFileError({ size: 100, type: "image/jpeg" }, 5)).not.toBeNull(); });
  it("requires a contact name and phone or email", () => { expect(validContactCard({ name: "Test", phone: "", email: "", company: "" })).toBe(false); expect(validContactCard({ name: "Test", phone: "+35612345678", email: "", company: "" })).toBe(true); });
  it("escapes contact content instead of injecting vcard lines", () => { expect(contactVcard({ name: "Test\nTEL:fake", phone: "123", email: "", company: "" })).toContain("FN:Test\\nTEL:fake\r\nORG:"); });
  it("ignores malformed attachments", () => { expect(parseChatFiles([{ path: "x" }, null])).toEqual([]); });
});