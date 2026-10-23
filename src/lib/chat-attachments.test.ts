import { describe, it, expect } from "vitest";
import { chatFileError, contactVcard, parseChatFiles, validContactCard, MAX_CHAT_BYTES, chatImageDimensions, compressChatImage } from "./chat-attachments";
describe("private chat attachments", () => {
  it("caps the long edge at 1600 without upscaling", () => { expect(chatImageDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 }); expect(chatImageDimensions(200, 100)).toEqual({ width: 200, height: 100 }); });
  it("keeps document bytes unchanged", async () => { const file = new File(["original document"], "test.pdf", { type: "application/pdf" }); expect(await compressChatImage(file)).toBe(file); });
  it("keeps original-quality images unchanged", async () => { const file = new File(["original image"], "test.jpg", { type: "image/jpeg" }); expect(await compressChatImage(file, true)).toBe(file); });
  it("accepts photos and PDF documents", () => { expect(chatFileError({ size: 100, type: "image/jpeg" }, 0)).toBeNull(); expect(chatFileError({ size: 100, type: "application/pdf" }, 0)).toBeNull(); });
  it("rejects executable and HTML uploads", () => { expect(chatFileError({ size: 100, type: "text/html" }, 0)).not.toBeNull(); });
  it("limits files to 20 MB", () => { expect(chatFileError({ size: MAX_CHAT_BYTES + 1, type: "image/jpeg" }, 0)).not.toBeNull(); });
  it("limits messages to five files", () => { expect(chatFileError({ size: 100, type: "image/jpeg" }, 5)).not.toBeNull(); });
  it("requires a contact name and phone or email", () => { expect(validContactCard({ name: "Test", phone: "", email: "", company: "" })).toBe(false); expect(validContactCard({ name: "Test", phone: "+35612345678", email: "", company: "" })).toBe(true); });
  it("escapes contact content instead of injecting vcard lines", () => { expect(contactVcard({ name: "Test\nTEL:fake", phone: "123", email: "", company: "" })).toContain("FN:Test\\nTEL:fake\r\nORG:"); });
  it("ignores malformed attachments", () => { expect(parseChatFiles([{ path: "x" }, null])).toEqual([]); });
});