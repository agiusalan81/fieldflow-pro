import { layerColor, DEFAULT_TEXT_STYLES, type PdfTemplate, type TextLayerKey } from "./documents";
import type { Appearance } from "./branding";
import lato from "@/assets/branding-lato.ttf.asset.json";
import abel from "@/assets/branding-abel.ttf.asset.json";

type BrandClient = { storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } } };
export const DOCUMENT_FONT_OPTIONS = [{ value: "standard", label: "Standard document font" }, { value: "lato", label: "Lato — clean" }, { value: "abel", label: "Abel — compact" }, { value: "custom", label: "Company font" }] as const;
export function bytesData(bytes: Uint8Array, mime: string) { let bin = ""; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192)); return `data:${mime};base64,${btoa(bin)}`; }
export async function brandDownload(client: BrandClient, path: string) {
  if (!path) return "";
  const { data, error } = await client.storage.from("company-branding").download(path);
  if (error || !data) throw new Error("Could not load company branding file");
  return bytesData(new Uint8Array(await data.arrayBuffer()), path.endsWith(".png") ? "image/png" : path.endsWith(".jpg") ? "image/jpeg" : "font/ttf");
}
export async function resolveDocumentAssets(client: BrandClient, t: PdfTemplate): Promise<PdfTemplate> {
  const [fontData, backgroundData] = await Promise.all([t.documentFont === "custom" && t.fontPath ? brandDownload(client, t.fontPath) : Promise.resolve(t.fontData ?? ""), t.backgroundPath ? brandDownload(client, t.backgroundPath) : Promise.resolve(t.backgroundData ?? "")]);
  return { ...t, fontData, backgroundData };
}
export async function resolveAppearanceAssets(client: BrandClient, a: Appearance): Promise<Appearance> {
  const [backgroundData, menuBackgroundData] = await Promise.all([brandDownload(client, a.backgroundPath), brandDownload(client, a.menuBackgroundPath)]);
  return { ...a, backgroundData, menuBackgroundData };
}
export function documentFontSource(t: PdfTemplate) { return t.documentFont === "custom" ? t.fontData ?? "" : t.documentFont === "lato" ? lato.url : t.documentFont === "abel" ? abel.url : ""; }
export function documentFontFamily(t: PdfTemplate) { return t.documentFont && t.documentFont !== "standard" ? `"FieldBridgeDocument-${t.documentFont}", sans-serif` : t.font === "serif" ? '"Lora", Georgia, serif' : t.font === "mono" ? '"IBM Plex Mono", monospace' : '"IBM Plex Sans", sans-serif'; }
export async function loadDocumentFont(t: PdfTemplate) {
  const source = documentFontSource(t); if (!source || typeof document === "undefined") return;
  const family = `FieldBridgeDocument-${t.documentFont}`;
  const face = new FontFace(family, `url("${source}")`);
  await face.load(); document.fonts.add(face); return () => document.fonts.delete(face);
}
export async function pdfFonts(doc: import("pdf-lib").PDFDocument, t: PdfTemplate) {
  const { StandardFonts } = await import("pdf-lib");
  const source = documentFontSource(t);
  if (source) {
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    doc.registerFontkit(fontkit);
    const url = source.startsWith("/") ? (typeof window === "undefined" ? `https://fieldbridgeapp.com${source}` : source) : source;
    const response = await fetch(url); if (!response.ok) throw new Error("Could not load document font");
    const font = await doc.embedFont(await response.arrayBuffer(), { subset: true }); return { font, bold: font };
  }
  return { font: await doc.embedFont(t.font === "serif" ? StandardFonts.TimesRoman : t.font === "mono" ? StandardFonts.Courier : StandardFonts.Helvetica), bold: await doc.embedFont(t.font === "serif" ? StandardFonts.TimesRomanBold : t.font === "mono" ? StandardFonts.CourierBold : StandardFonts.HelveticaBold) };
}
export async function pdfPageDecoration(doc: import("pdf-lib").PDFDocument, t: PdfTemplate) {
  const { rgb } = await import("pdf-lib");
  const hex = (v: string) => rgb(parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255);
  const image = t.backgroundData ? (t.backgroundData.startsWith("data:image/png") ? await doc.embedPng(t.backgroundData) : await doc.embedJpg(t.backgroundData)) : null;
  return (page: import("pdf-lib").PDFPage) => {
    const { width, height } = page.getSize();
    if (image) page.drawImage(image, { x: 0, y: 0, width, height, opacity: .12 });
    if (t.frame && t.frame !== "none") { for (const inset of t.frame === "double" ? [18, 23] : [18]) page.drawRectangle({ x: inset, y: inset, width: width - 2 * inset, height: height - 2 * inset, borderWidth: .8, borderColor: hex(t.primaryColor) }); }
  };
}
const STANDARD_FAMILY = { sans: '"IBM Plex Sans", sans-serif', serif: '"Lora", Georgia, serif', mono: '"IBM Plex Mono", monospace' } as const;
/** On-screen style for one text layer (company name, headings, details). */
export function layerStyle(t: PdfTemplate, k: TextLayerKey): import("react").CSSProperties {
  const l = t.textStyles?.[k] ?? DEFAULT_TEXT_STYLES[k];
  const fill = l.background ? { backgroundColor: l.background, padding: "2px 8px", borderRadius: 6, display: "inline-block" } : {};
  return { fontFamily: l.font === "document" ? documentFontFamily(t) : STANDARD_FAMILY[l.font], color: layerColor(t, k), fontWeight: l.bold ? 700 : 400, fontStyle: l.italic ? "italic" : "normal", ...fill };
}
/** PDF font + colour for each text layer. Company fonts have no separate italic, so italic applies only to standard families. */
export async function pdfLayerFonts(doc: import("pdf-lib").PDFDocument, t: PdfTemplate, base: { font: import("pdf-lib").PDFFont; bold: import("pdf-lib").PDFFont }) {
  const { StandardFonts, rgb } = await import("pdf-lib");
  const names = { sans: ["Helvetica", "HelveticaBold", "HelveticaOblique", "HelveticaBoldOblique"], serif: ["TimesRoman", "TimesRomanBold", "TimesRomanItalic", "TimesRomanBoldItalic"], mono: ["Courier", "CourierBold", "CourierOblique", "CourierBoldOblique"] } as const;
  const hex = (v: string) => rgb(parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255);
  const one = async (k: TextLayerKey) => {
    const l = t.textStyles?.[k] ?? DEFAULT_TEXT_STYLES[k];
    const font = l.font === "document" ? (l.bold ? base.bold : base.font) : await doc.embedFont(StandardFonts[names[l.font][(l.bold ? 1 : 0) + (l.italic ? 2 : 0)] as keyof typeof StandardFonts]);
    return { font, color: hex(layerColor(t, k)) };
  };
  return { company: await one("company"), label: await one("label"), detail: await one("detail") };
}
