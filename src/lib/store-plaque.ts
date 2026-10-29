export type PlaqueSize = "a6" | "a5" | "a4" | "a3";
import { BRAND_FONTS, brandFont } from "./brand-fonts";

export const PLAQUE_SIZES: Record<PlaqueSize, { label: string; page: string; scale: number; width: number; height: number }> = {
  a6: { label: "A6 counter card", page: "A6", scale: 0.5, width: 105, height: 148 },
  a5: { label: "A5 staff room card", page: "A5", scale: 0.7, width: 148, height: 210 },
  a4: { label: "A4 wall poster", page: "A4", scale: 1, width: 210, height: 297 },
  a3: { label: "A3 large poster", page: "A3", scale: 1.41, width: 297, height: 420 },
};
export type PlaqueMessage = { text: string; font: string; color: string; bold: boolean; underline: boolean };
export const PLAQUE_FONT_OPTIONS = [{ value: "standard", label: "Standard" }, ...BRAND_FONTS];
export function defaultPlaqueMessages(): { headline: PlaqueMessage; subtitle: PlaqueMessage } {
  return { headline: { text: "Spot a problem?", font: "standard", color: "", bold: true, underline: false }, subtitle: { text: "Scan to report it to our maintenance team", font: "standard", color: "", bold: false, underline: false } };
}
export const STORE_REPORT_CATEGORIES = ["Floors & tiles", "Spill or trip hazard", "Toilets & washrooms", "Lighting & electrics", "Doors, shutters & entrances", "Ceilings, walls & leaks", "Trolleys & car park", "Fridges & freezers", "Other"];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Printable plaque document; one page per copy. */
export function plaqueHtml(o: { size: PlaqueSize; copies: number; qr: string; store: string; company: string; logo?: string | undefined; headline?: PlaqueMessage; subtitle?: PlaqueMessage }) {
  const s = PLAQUE_SIZES[o.size], k = s.scale;
  const defaults = defaultPlaqueMessages(), headline = o.headline ?? defaults.headline, subtitle = o.subtitle ?? defaults.subtitle;
  const messageStyle = (m: PlaqueMessage) => `font-family:${brandFont(m.font) ? `Plaque-${brandFont(m.font)?.value},sans-serif` : "system-ui,sans-serif"};color:${/^#[\da-f]{6}$/i.test(m.color) ? m.color : "var(--plaque-ink)"};font-weight:${m.bold ? 700 : 400};text-decoration:${m.underline ? "underline" : "none"}`;
  const fonts = [...new Set([headline.font, subtitle.font])].flatMap(id => { const f = brandFont(id); return f ? [`@font-face{font-family:Plaque-${f.value};src:url("${esc(f.source)}")} `] : []; }).join("");
  const page = `<section class="p">${o.logo ? `<img class="logo" src="${esc(o.logo)}" alt="">` : ""}<h1 style="${messageStyle(headline)}">${esc(headline.text)}</h1><p class="sub" style="${messageStyle(subtitle)}">${esc(subtitle.text)}</p><img class="qr" src="${esc(o.qr)}" alt="QR code"><p class="store">${esc(o.store)}</p><p class="hint">Broken tiles · spills · toilets · lights · doors · leaks</p><p class="foot">No app or login needed${o.company ? ` · ${esc(o.company)}` : ""}</p></section>`;
  return `<!doctype html><html><head><title>Report a problem — ${esc(o.store)}</title><style>
${fonts}:root{--plaque-ink:#111;--plaque-paper:#fff;--plaque-muted:#555}
@page{size:${s.page};margin:0}*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:var(--plaque-ink);background:var(--plaque-paper);print-color-adjust:exact}
.p{width:${s.width}mm;height:${s.height}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${8 * k}mm;page-break-after:always;border:${3 * k}mm solid var(--plaque-ink)}
.p:last-child{page-break-after:auto}.logo{max-height:${18 * k}mm;max-width:60%;object-fit:contain;margin-bottom:${4 * k}mm}
h1{font-size:${15 * k}mm;margin:0;line-height:1.1}.sub{font-size:${6 * k}mm;margin:${3 * k}mm 0 ${6 * k}mm;line-height:1.2}
h1,.sub,.store{max-width:100%;overflow-wrap:anywhere;white-space:pre-wrap}
.qr{width:${95 * k}mm;height:${95 * k}mm;flex-shrink:0}.store{font-size:${8 * k}mm;font-weight:700;margin:${5 * k}mm 0 ${2 * k}mm}
.hint{font-size:${5 * k}mm;margin:0}.foot{font-size:${4 * k}mm;margin-top:${5 * k}mm;color:var(--plaque-muted)}
</style></head><body>${Array.from({ length: Math.max(1, o.copies) }, () => page).join("")}</body></html>`;
}
