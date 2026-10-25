import { customerQuoteDocument, quoteLineTotals, quoteTotals, type QuoteSnapshot } from './customer-quotes';

/** Same safe document projection as preview and delivery; no internal fields accepted. */
export async function buildCustomerQuotePdf(s: QuoteSnapshot): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const d = customerQuoteDocument(s.document); const t = quoteTotals(d.lines);
  const doc = await PDFDocument.create(); doc.setTitle(`${s.reference} ${d.title}`);
  const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const primary = /^#[0-9a-f]{6}$/i.test(s.company.primary ?? '') ? s.company.primary ?? '#14213d' : '#14213d';
  const brand = rgb(parseInt(primary.slice(1, 3), 16) / 255, parseInt(primary.slice(3, 5), 16) / 255, parseInt(primary.slice(5, 7), 16) / 255);
  const ink = rgb(.13, .13, .13); const grey = rgb(.45, .45, .45);
  const safe = (v: string) => v.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, 'x').replace(/[^\x0A\x20-\x7E\xA0-\xFF€]/g, '?');
  const money = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: s.currency }).format(v);
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | undefined;
  try { if (s.company.logo?.startsWith('data:image/png')) logo = await doc.embedPng(s.company.logo); else if (s.company.logo?.startsWith('data:image/jp')) logo = await doc.embedJpg(s.company.logo); } catch { logo = undefined; }
  let page = doc.addPage([595, 842]); let y = 732;
  const header = () => {
    if (logo) { const scale = Math.min(95 / logo.width, 40 / logo.height); page.drawImage(logo, { x: 42, y: 778, width: logo.width * scale, height: logo.height * scale }); }
    page.drawText(safe(s.company.name).slice(0, 55), { x: logo ? 148 : 42, y: 796, size: 12, font: bold, color: brand });
    page.drawText(safe(`${d.kind.toUpperCase()} ${s.reference}`), { x: 345, y: 772, size: 10, font: bold, color: brand });
    page.drawLine({ start: { x: 42, y: 758 }, end: { x: 553, y: 758 }, thickness: 1, color: brand });
  }; header();
  const write = (text: string, size = 10, strong = false) => {
    const f = strong ? bold : font;
    for (const paragraph of safe(text).split('\n')) {
      let line = '';
      const draw = () => { if (y < 75) { page = doc.addPage([595, 842]); y = 732; header(); } page.drawText(line, { x: 42, y, size, font: f, color: ink }); y -= size + 5; };
      for (let word of paragraph.split(/\s+/)) {
        while (f.widthOfTextAtSize(word, size) > 510) { if (line) { draw(); line = ''; } let cut = 1; while (cut < word.length && f.widthOfTextAtSize(word.slice(0, cut + 1), size) <= 510) cut++; line = word.slice(0, cut); draw(); line = ''; word = word.slice(cut); }
        const next = `${line} ${word}`.trim(); if (f.widthOfTextAtSize(next, size) > 510 && line) { draw(); line = word; } else line = next;
      } draw();
    }
  };
  write(d.title, 16, true); write(`Revision ${s.revision} | Issued ${d.issue_date} | Valid until ${d.valid_until}`, 9);
  if (s.company.address) write(s.company.address, 9); if (s.company.vat) write(`VAT ${s.company.vat}`, 9);
  write(`Client: ${s.client}`, 10, true); if (s.site) write(`Site: ${s.site}`); if (s.equipment) write(`Equipment: ${s.equipment}`);
  if (d.scope) { write('Scope', 11, true); write(d.scope); }
  write('Priced items', 11, true);
  for (const l of d.lines) { write(l.description, 10, true); write(`${l.quantity} ${l.unit} x ${money(l.rate)} | Discount ${l.discount}% | VAT ${l.vat}% | Net ${money(quoteLineTotals(l).net)}`, 9); }
  write(`Subtotal ${money(t.subtotal)} | Discount ${money(t.discount)}`, 10); write(`Net ${money(t.net)} | VAT ${money(t.vat)} | Total ${money(t.total)}`, 12, true);
  for (const [title, text] of [['Payment terms', d.payment], ['Expected work timeframe', d.timeframe], ['Exclusions', d.exclusions], ['Customer notes', d.notes]]) { if (text) { write(title, 11, true); write(text); } }
  doc.getPages().forEach((p, i) => { p.drawText(safe(s.company.footer ?? '').slice(0, 100), { x: 42, y: 40, size: 8, font, color: grey }); p.drawText(`${i + 1} / ${doc.getPageCount()}`, { x: 515, y: 40, size: 8, font, color: grey }); });
  return doc.save();
}