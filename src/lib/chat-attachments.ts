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
  return { name: value.name, phone: typeof v.phone === "string" ? v.phone : "", email: typeof v.email === "string" ? v.email : "", company: typeof v.company === "string" ? v.company : "" };
}
export function validContactCard(v: ContactCard) { return !!v.name.trim() && (!!v.phone.trim() || !!v.email.trim()) && (!v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)); }
const escapeVcard = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
export function contactVcard(v: ContactCard) { return ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVcard(v.name)}`, `ORG:${escapeVcard(v.company)}`, `TEL:${escapeVcard(v.phone)}`, `EMAIL:${escapeVcard(v.email)}`, "END:VCARD"].join("\r\n"); }