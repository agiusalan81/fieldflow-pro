import { platformCredit } from "@/lib/platform-credit";
/** Client proposal PDF (A4): letterhead, specification, priced lines, offer and commercial terms. */
import { lineTotal } from "./price-list";
import { proposalTotals, visibleSections, type Line, type Spec, type Terms } from "./proposals";

export type ProposalPdfInput = {
  company: { name: string; logo?: string; address?: string; vat?: string; footer?: string; primary?: string };
  reference: string; title: string; date: string; client?: string | undefined; site?: string | undefined; currency: string;
  trade: string; spec: Spec; lines: Line[]; terms: Terms;
};

export async function buildProposalPdf(d: ProposalPdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.reference} ${d.title}`.trim());
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 42, CW = W - M * 2, TOP = H - M - 74, BOTTOM = M + 30;
  const hex = /^#[0-9a-f]{6}$/i.test(d.company.primary ?? "") ? d.company.primary! : "#1f3a5f";
  const brand = rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
  const ink = rgb(0.13, 0.13, 0.13), grey = rgb(0.42, 0.42, 0.42), band = rgb(0.95, 0.95, 0.95);
  const safe = (v: string) => (v ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/•/g, "-").replace(/×/g, "x").replace(/[^\x0A\x20-\x7E\xA0-\xFF€]/g, "?");
  const money = (n: number) => `${d.currency === "EUR" ? "€" : d.currency + " "}${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    if (d.company.logo?.startsWith("data:image/png")) logo = await doc.embedPng(d.company.logo);
    else if (d.company.logo?.startsWith("data:image/jp")) logo = await doc.embedJpg(d.company.logo);
  } catch { logo = null; }

  const pages: ReturnType<typeof doc.addPage>[] = [];
  let page = doc.addPage([W, H]); pages.push(page); let y = TOP;
  const header = () => {
    let x = M;
    if (logo) { const s = Math.min(40 / logo.height, 110 / logo.width); page.drawImage(logo, { x: M, y: H - M - 40, width: logo.width * s, height: logo.height * s }); x = M + logo.width * s + 10; }
    page.drawText(safe(d.company.name), { x, y: H - M - 16, size: 12, font: bold, color: ink });
    if (d.company.address) page.drawText(safe(d.company.address).slice(0, 90), { x, y: H - M - 30, size: 8, font, color: grey });
    const right = safe(`Proposal ${d.reference}`); page.drawText(right, { x: W - M - bold.widthOfTextAtSize(right, 10), y: H - M - 16, size: 10, font: bold, color: brand });
    page.drawText(safe(d.date), { x: W - M - font.widthOfTextAtSize(safe(d.date), 8), y: H - M - 30, size: 8, font, color: grey });
    page.drawLine({ start: { x: M, y: H - M - 48 }, end: { x: W - M, y: H - M - 48 }, thickness: 1.5, color: brand });
  };
  header();
  const need = (h: number) => { if (y - h < BOTTOM) { page = doc.addPage([W, H]); pages.push(page); header(); y = TOP; } };
  const wrap = (v: string, w: number, size: number, f = font) => {
    const out: string[] = [];
    for (const para of safe(v).split("\n")) { let line = ""; for (const word of para.split(/\s+/)) { const t = `${line} ${word}`.trim(); if (f.widthOfTextAtSize(t, size) > w && line) { out.push(line); line = word; } else line = t; } out.push(line); }
    return out;
  };
  const para = (v: string, size = 9, x = M, w = CW, f = font, color = ink) => { for (const l of wrap(v, w, size, f)) { need(size + 4); page.drawText(l, { x, y, size, font: f, color }); y -= size + 4; } };
  const heading = (t: string) => { need(30); y -= 6; page.drawRectangle({ x: M, y: y - 5, width: CW, height: 17, color: brand }); page.drawText(safe(t).toUpperCase(), { x: M + 6, y, size: 9, font: bold, color: rgb(1, 1, 1) }); y -= 20; };
  const row = (label: string, value: string) => {
    const lines = wrap(value, CW * 0.6 - 8, 9); const h = lines.length * 13;
    need(h + 2); page.drawText(safe(label), { x: M + 4, y, size: 9, font: bold, color: grey });
    lines.forEach((l, i) => page.drawText(l, { x: M + CW * 0.4, y: y - i * 13, size: 9, font, color: ink }));
    y -= h; page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.3, color: band });
  };
  const list = (items: string[]) => items.filter((s) => s.trim()).forEach((s) => para(`-  ${s}`, 9, M + 6, CW - 6));

  // Title block
  para(d.title || "Proposal", 16, M, CW, bold);
  y -= 2;
  if (d.client) para(`Client: ${d.client}`, 10);
  if (d.site) para(`Site: ${d.site}`, 10);
  const eq = [d.spec.scope, d.spec.equipment_type, d.spec.equipment_subtype, d.spec.equipment_other].filter(Boolean).join(" · ");
  if (eq) para(`Equipment: ${eq}`, 10);
  y -= 6;

  for (const s of visibleSections(d.spec, d.trade)) {
    const filled = s.fields.filter((fl) => (d.spec[fl.key] ?? "").trim());
    if (!filled.length) continue;
    heading(s.title); filled.forEach((fl) => row(fl.label, d.spec[fl.key]!));
  }

  const priced = (title: string, items: Line[]) => {
    if (!items.length) return;
    heading(title);
    const cols = [M + 4, M + CW * 0.56, M + CW * 0.68, M + CW * 0.82];
    need(14); ["Item", "Qty", "Rate", "Amount"].forEach((h, i) => page.drawText(h, { x: i ? cols[i]! : cols[0]!, y, size: 8, font: bold, color: grey })); y -= 13;
    let lastCat = "";
    for (const l of items) {
      if (l.category && l.category !== lastCat) { need(14); page.drawText(safe(l.category), { x: M + 4, y, size: 8.5, font: bold, color: brand }); y -= 12; lastCat = l.category; }
      const name = wrap(l.name + (l.method ? ` (${l.method})` : ""), CW * 0.52, 9); need(name.length * 12 + 2);
      name.forEach((t, i) => page.drawText(t, { x: M + 10, y: y - i * 12, size: 9, font, color: ink }));
      const amt = lineTotal(l.quantity, l.rate, 0).net;
      page.drawText(safe(`${l.quantity} ${l.unit}`), { x: cols[1]!, y, size: 9, font, color: ink });
      page.drawText(safe(money(l.rate)), { x: cols[2]!, y, size: 9, font, color: ink });
      const a = safe(money(amt)); page.drawText(a, { x: W - M - 4 - font.widthOfTextAtSize(a, 9), y, size: 9, font, color: ink });
      y -= name.length * 12 + 2;
    }
  };
  priced(d.trade === "elevator" ? "Additional items" : "Bill of quantities", d.lines.filter((l) => !l.optional));

  if (d.terms.others.trim()) { heading("Others"); para(d.terms.others); }

  // Our offer
  const t = proposalTotals(d.lines, d.terms);
  heading("Our offer");
  const sum = (label: string, v: number, strong = false) => { need(16); const f = strong ? bold : font; page.drawText(label, { x: M + CW * 0.5, y, size: strong ? 11 : 10, font: f, color: ink }); const s = safe(money(v)); page.drawText(s, { x: W - M - 4 - f.widthOfTextAtSize(s, strong ? 11 : 10), y, size: strong ? 11 : 10, font: f, color: ink }); y -= 16; };
  sum("Net price (excl. VAT)", t.net); sum(`VAT`, t.vat); sum("Total price", t.total, true);
  const options = d.lines.filter((l) => l.optional);
  if (options.length) {
    y -= 4; para("Pricing alternatives / options (not included in the total above)", 9, M, CW, bold);
    options.forEach((o) => { const v = lineTotal(o.quantity, o.rate, o.vat); row(o.name + (o.quantity !== 1 ? ` × ${o.quantity}` : ""), `${money(v.net)} + VAT = ${money(v.total)}`); });
  }

  const pay = d.terms.payment.filter((p) => p.trim());
  if (pay.length) { heading("Payment terms"); pay.forEach((p, i) => para(`${i + 1}.  ${p}`, 9, M + 6, CW - 6)); }
  heading("Guarantee");
  para(`${d.terms.warranty_years} year${d.terms.warranty_years === "1" ? "" : "s"} — ${d.terms.warranty_cover}`, 9, M + 6, CW - 6, bold);
  if (d.terms.warranty_notes.trim()) para(d.terms.warranty_notes, 9, M + 6, CW - 6);
  if (d.terms.client_items.some((s) => s.trim())) { heading("Items to be provided by the client"); list(d.terms.client_items); }
  if (d.terms.exclusions.some((s) => s.trim())) { heading("Exclusions"); list(d.terms.exclusions); }
  if (d.terms.delivery.trim() || d.terms.delivery_notes.trim()) { heading("Delivery time"); if (d.terms.delivery.trim()) para(d.terms.delivery, 9, M + 6, CW - 6, bold); if (d.terms.delivery_notes.trim()) para(d.terms.delivery_notes, 9, M + 6, CW - 6); }
  if (d.terms.notes.trim()) { heading("Notes"); para(d.terms.notes); }

  need(70); y -= 24;
  page.drawLine({ start: { x: M, y }, end: { x: M + 200, y }, thickness: 0.5, color: grey });
  page.drawLine({ start: { x: W - M - 200, y }, end: { x: W - M, y }, thickness: 0.5, color: grey });
  page.drawText(safe(`For ${d.company.name}`), { x: M, y: y - 12, size: 8, font, color: grey });
  page.drawText("Accepted by client — name, signature & date", { x: W - M - 200, y: y - 12, size: 8, font, color: grey });

  const foot = safe([d.company.footer, d.company.vat && `VAT ${d.company.vat}`].filter(Boolean).join(" · ")).slice(0, 110);
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 16 }, end: { x: W - M, y: M + 16 }, thickness: 0.4, color: grey });
    if (foot) p.drawText(foot, { x: M, y: M + 4, size: 7.5, font, color: grey });
    p.drawText(platformCredit(), { x: M, y: M - 6, size: 6, font, color: grey });
    const n = `Page ${i + 1} of ${pages.length}`; p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 7.5), y: M + 4, size: 7.5, font, color: grey });
  });
  return doc.save();
}
