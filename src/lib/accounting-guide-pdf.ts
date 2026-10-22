import { ACCOUNTING, ACCOUNTING_GUIDES, type AccountingKey } from "@/lib/integrations";

/** Builds a simple A4 PDF of the connection guide for one accounting provider. */
export async function accountingGuidePdf(key: AccountingKey, company: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const g = ACCOUNTING_GUIDES[key];
  const name = ACCOUNTING.find((a) => a.key === key)?.label ?? key;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 50, width = W - 2 * M;
  let page = doc.addPage([W, H]); let y = H - M;
  const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, (c) => (c === "→" ? "->" : c === "×" ? "x" : ""));
  const wrap = (s: string, size: number, f = font) => { const out: string[] = []; let line = ""; for (const w of safe(s).split(" ")) { const next = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(next, size) > width - 20) { out.push(line); line = w; } else line = next; } if (line) out.push(line); return out; };
  const write = (s: string, size = 10, f = font, indent = 0) => { for (const l of wrap(s, size, f)) { if (y < M + size) { page = doc.addPage([W, H]); y = H - M; } page.drawText(l, { x: M + indent, y, size, font: f, color: rgb(0.13, 0.13, 0.13) }); y -= size + 5; } };
  write(`${company ? `${company} - ` : ""}Connecting ${name}`, 16, bold); y -= 6;
  write(g.intro); y -= 8;
  write("Before you start", 12, bold); g.before.forEach((b) => write(`- ${b}`, 10, font, 10)); y -= 8;
  write("Steps", 12, bold); g.steps.forEach((s, i) => write(`${i + 1}. ${s}`, 10, font, 10)); y -= 8;
  write(`More help: ${g.link}`, 9);
  return doc.save();
}
