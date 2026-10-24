/** Accounting-neutral estimate export (Zoho Books, QuickBooks, Xero and Sage all import CSV estimates). */
const cell = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function estimateExportCsv(e: { title: string; client: string; site: string; notes: string; price: number | null; fixedLabour: boolean; taxRate: string; incomeAccount: string }) {
  const head = ["Customer Name", "Estimate Title", "Site", "Item Description", "Quantity", "Rate", "Tax", "Account", "Notes"];
  const desc = e.fixedLabour ? `${e.title} (labour included)` : `${e.title} (labour billed from job sheet hours)`;
  const row = [e.client, e.title, e.site, desc, 1, e.price == null ? "" : e.price.toFixed(2), e.taxRate, e.incomeAccount, e.notes];
  return `${head.map(cell).join(",")}\n${row.map(cell).join(",")}\n`;
}
