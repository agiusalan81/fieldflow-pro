export type PlaqueSize = "a6" | "a5" | "a4" | "a3";
export const PLAQUE_SIZES: Record<PlaqueSize, { label: string; page: string; scale: number }> = {
  a6: { label: "A6 counter card", page: "A6", scale: 0.5 },
  a5: { label: "A5 staff room card", page: "A5", scale: 0.7 },
  a4: { label: "A4 wall poster", page: "A4", scale: 1 },
  a3: { label: "A3 large poster", page: "A3", scale: 1.41 },
};
export const STORE_REPORT_CATEGORIES = ["Floors & tiles", "Spill or trip hazard", "Toilets & washrooms", "Lighting & electrics", "Doors, shutters & entrances", "Ceilings, walls & leaks", "Trolleys & car park", "Fridges & freezers", "Other"];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Printable plaque document; one page per copy. */
export function plaqueHtml(o: { size: PlaqueSize; copies: number; qr: string; store: string; company: string; logo?: string | undefined }) {
  const s = PLAQUE_SIZES[o.size], k = s.scale;
  const page = `<section class="p">${o.logo ? `<img class="logo" src="${esc(o.logo)}" alt="">` : ""}<h1>Spot a problem?</h1><p class="sub">Scan to report it to our maintenance team</p><img class="qr" src="${o.qr}" alt="QR code"><p class="store">${esc(o.store)}</p><p class="hint">Broken tiles · spills · toilets · lights · doors · leaks</p><p class="foot">No app or login needed${o.company ? ` · ${esc(o.company)}` : ""}</p></section>`;
  return `<!doctype html><html><head><title>Report a problem — ${esc(o.store)}</title><style>
@page{size:${s.page};margin:0}*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:#111}
.p{width:100%;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${8 * k}mm;page-break-after:always;border:${3 * k}mm solid #111}
.p:last-child{page-break-after:auto}.logo{max-height:${18 * k}mm;max-width:60%;object-fit:contain;margin-bottom:${4 * k}mm}
h1{font-size:${22 * k}mm;margin:0;line-height:1}.sub{font-size:${7 * k}mm;margin:${3 * k}mm 0 ${6 * k}mm}
.qr{width:${110 * k}mm;height:${110 * k}mm}.store{font-size:${9 * k}mm;font-weight:700;margin:${5 * k}mm 0 ${2 * k}mm}
.hint{font-size:${5 * k}mm;margin:0}.foot{font-size:${4 * k}mm;margin-top:${5 * k}mm;color:#555}
</style></head><body>${Array.from({ length: Math.max(1, o.copies) }, () => page).join("")}</body></html>`;
}
