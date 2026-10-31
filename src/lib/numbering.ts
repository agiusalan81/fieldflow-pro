export type NumberingKind = "estimate" | "quote" | "proposal" | "job_sheet" | "invoice" | "site_visit";
export type NumberFormat = { prefix: string; padding: number; next: number };

export const NUMBERED_DOCUMENTS: { key: NumberingKind; label: string; prefix: string; note?: string }[] = [
  { key: "estimate", label: "Estimates", prefix: "EST-" },
  { key: "quote", label: "Quotes", prefix: "QUO-" },
  { key: "proposal", label: "Proposals", prefix: "PRP-" },
  { key: "job_sheet", label: "Job sheets", prefix: "JS-" },
  { key: "site_visit", label: "Site visits / surveys", prefix: "VIS-", note: "Every new site survey or visit gets this reference, in Core and in the Lift pack." },
  { key: "invoice", label: "Invoices", prefix: "INV-", note: "Client billing shares this next-number sequence. Set its document prefix in Client billing setup." },
];

/** Mirrors the database: prefix + number padded to the chosen digits (never truncated). */
export function formatDocumentNumber(f: NumberFormat, n: number = f.next): string {
  const digits = String(Math.max(1, Math.floor(n)));
  return `${f.prefix}${digits.padStart(Math.max(1, Math.floor(f.padding)), "0")}`;
}
