import { platformCredit } from './platform-credit';
import { BILLING_KINDS, billingNotice, type BillingSnapshot } from './client-billing';
import { quoteLineTotals } from './customer-quotes';

export async function buildBillingPdf(s: BillingSnapshot): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); pdf.setTitle(`${BILLING_KINDS[s.kind]} ${s.reference}`);
  const normal = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]); let y = 790;
  const safe = (value: string) => value.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x0A\x20-\x7E\xA0-\xFF€]/g, '?');
  const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: s.currency }).format(value);
  const write = (text: string, strong = false, size = 10) => {
    const font = strong ? bold : normal;
    for (const paragraph of safe(text).split('\n')) {
      let line = '';
      const draw = () => { if (y < 65) { page = pdf.addPage([595, 842]); y = 790; } page.drawText(line, { x: 42, y, size, font }); y -= size + 7; };
      for (let word of paragraph.split(/\s+/)) {
        while (font.widthOfTextAtSize(word, size) > 510) { if (line) { draw(); line = ''; } let cut = 1; while (cut < word.length && font.widthOfTextAtSize(word.slice(0, cut + 1), size) <= 510) cut++; line = word.slice(0, cut); draw(); line = ''; word = word.slice(cut); }
        const next = `${line} ${word}`.trim(); if (line && font.widthOfTextAtSize(next, size) > 510) { draw(); line = word; } else line = next;
      } draw();
    }
  };
  if (s.company.logo?.startsWith('data:image/')) {
    try { const logo = s.company.logo.startsWith('data:image/png') ? await pdf.embedPng(s.company.logo) : await pdf.embedJpg(s.company.logo); const scale = Math.min(100 / logo.width, 45 / logo.height); page.drawImage(logo, { x: 42, y: y - 45, width: logo.width * scale, height: logo.height * scale }); y -= 60; } catch { /* Text identity remains available. */ }
  }
  write(s.company.name, true, 16); write(s.company.address); if (s.company.vat) write(`VAT: ${s.company.vat}`);
  write(`${BILLING_KINDS[s.kind]} ${s.reference}`, true, 18); write(billingNotice(s.kind));
  write(s.document.title, true, 12); write(`Issued: ${s.document.issue_date} | Due: ${s.document.due_date}`);
  write(`Bill to: ${s.client.name}`, true); write(s.client.address);
  for (const l of s.document.lines) { write(l.description, true); write(`${l.quantity} ${l.unit} x ${money(l.rate)} | Discount ${l.discount}% | VAT ${l.vat}% | Net ${money(quoteLineTotals(l).net)}`); }
  write(`Net ${money(s.totals.net)} | VAT ${money(s.totals.vat)} | Total ${money(s.totals.total)}`, true, 12);
  if (s.kind === 'proforma' && s.document.deposit_pct) write(`Deposit requested: ${s.document.deposit_pct}% (${money(Math.round(s.totals.total * s.document.deposit_pct) / 100)})`, true);
  for (const [label, text] of [['Payment terms', s.document.payment_terms], ['Payment methods', s.document.payment_methods], ['Terms & conditions', s.document.terms], ['Notes', s.document.notes]]) if (text) { write(label ?? '', true); write(text); }
  pdf.getPages().forEach((p, i) => { p.drawText(platformCredit(), { x: 42, y: 30, size: 7, font: normal }); p.drawText(`${i + 1} / ${pdf.getPageCount()}`, { x: 515, y: 30, size: 8, font: normal }); });
  return pdf.save();
}