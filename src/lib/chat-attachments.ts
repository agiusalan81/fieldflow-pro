export const CHAT_BUCKET = "chat-attachments";
export const MAX_CHAT_FILES = 5;
export const MAX_CHAT_BYTES = 20 * 1024 * 1024;
export const CHAT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
  "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv", "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
export type ChatFile = { path: string; name: string; size: number; type: string };
export type ContactCard = { name: string; phone: string; email: string; company: string };
export const CHAT_IMAGE_EDGE = 1600;
export const CHAT_IMAGE_QUALITY = 0.82;
export function chatImageDimensions(width: number, height: number) {
  const scale = Math.min(1, CHAT_IMAGE_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
/** Browser-only, best effort: unsupported formats and larger encodings retain the original. */
export async function compressChatImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const dimensions = chatImageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Transparent imagery stays PNG rather than losing transparency to JPEG.
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, CHAT_IMAGE_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = type === "image/jpeg" ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
    return new File([blob], name, { type, lastModified: file.lastModified });
  } catch { return file; }
  finally { bitmap?.close(); }
}
export function chatFileError(file: { size: number; type: string }, count: number) {
  if (count >= MAX_CHAT_FILES) return "Attach up to 5 files per message.";
  if (!CHAT_TYPES[file.type]) return "Choose a photo, PDF, Word, Excel, CSV or text document.";
  if (file.size < 1 || file.size > MAX_CHAT_BYTES) return "Each file must be between 1 byte and 20 MB.";
  return null;
}
export function parseChatFiles(value: unknown): ChatFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is ChatFile => !!v && typeof v === "object" && typeof v.path === "string" && typeof v.name === "string" && typeof v.size === "number" && typeof v.type === "string" && !!CHAT_TYPES[v.type]);
}
export function parseContactCard(value: unknown): ContactCard | null {
  if (!value || typeof value !== "object" || !("name" in value) || typeof value.name !== "string") return null;
  const v = value as Record<string, unknown>;
  return { name: value.name, phone: typeof v["phone"] === "string" ? v["phone"] : "", email: typeof v["email"] === "string" ? v["email"] : "", company: typeof v["company"] === "string" ? v["company"] : "" };
}
export function validContactCard(v: ContactCard) { return !!v.name.trim() && (!!v.phone.trim() || !!v.email.trim()) && (!v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)); }
const escapeVcard = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
export function contactVcard(v: ContactCard) { return ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVcard(v.name)}`, `ORG:${escapeVcard(v.company)}`, `TEL:${escapeVcard(v.phone)}`, `EMAIL:${escapeVcard(v.email)}`, "END:VCARD"].join("\r\n"); }