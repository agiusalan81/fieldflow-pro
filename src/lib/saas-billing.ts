/** FieldBridge's own subscription billing (not tenant job billing — see billing.ts). */
export const STORAGE_BASE_GB = 10;
export const STORAGE_BLOCKS = [25, 100, 500, 1000] as const;
export type InvoiceLine = { label: string; quantity: number; unit_price: number; amount: number; basis: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const months = (c: string) => (c === "yearly" ? 12 : c === "quarterly" ? 3 : 1);

/** Billing period starting on `start`, ending the day before the next period. */
export function billingPeriod(start: string, cadence: string) {
  const s = new Date(`${start}T00:00:00Z`);
  const next = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + months(cadence), s.getUTCDate()));
  const end = new Date(next.getTime() - 86400000);
  return { period_start: iso(s), period_end: iso(end), next_start: iso(next) };
}

/** Frozen invoice totals. Agreed price (when set) replaces the catalogue subtotal via a discount line. */
export function buildInvoice(items: { name: string; price: number; billing_basis: string }[], users: number, agreedPrice: number | null, vatRate: number) {
  const lines: InvoiceLine[] = items.map((i) => {
    const q = i.billing_basis === "per_user" ? Math.max(0, users) : 1;
    return { label: i.name, quantity: q, unit_price: r2(i.price), amount: r2(i.price * q), basis: i.billing_basis };
  });
  const subtotal = r2(lines.reduce((s, l) => s + l.amount, 0));
  const discount = agreedPrice != null && agreedPrice >= 0 && agreedPrice < subtotal ? r2(subtotal - agreedPrice) : 0;
  const net = agreedPrice != null && agreedPrice > subtotal ? r2(agreedPrice) : r2(subtotal - discount);
  if (agreedPrice != null && agreedPrice > subtotal) lines.push({ label: "Agreed package adjustment", quantity: 1, unit_price: r2(agreedPrice - subtotal), amount: r2(agreedPrice - subtotal), basis: "company" });
  const vat = r2(net * Math.max(0, vatRate) / 100);
  return { lines, subtotal: agreedPrice != null && agreedPrice > subtotal ? r2(agreedPrice) : subtotal, discount, vat_rate: vatRate, vat, total: r2(net + vat) };
}

export type ReminderStage = "renewal_7d" | "issued" | "due_3d" | "due_today" | "overdue_7d" | "overdue_14d" | "overdue_30d";
export const REMINDER_LABELS: Record<ReminderStage, string> = {
  renewal_7d: "Renews in 7 days", issued: "Invoice issued", due_3d: "Due in 3 days", due_today: "Due today",
  overdue_7d: "7 days overdue", overdue_14d: "Final notice (14 days overdue)", overdue_30d: "30 days overdue — review access",
};

/** The reminder stage that applies on `today` for an unpaid invoice, or null. */
export function reminderStage(inv: { status: string; issue_date: string; due_date: string; period_end: string }, today: string): ReminderStage | null {
  if (inv.status === "paid" || inv.status === "void" || inv.status === "draft") return null;
  const day = (a: string, b: string) => Math.round((new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000);
  const overdue = day(today, inv.due_date);
  if (overdue >= 30) return "overdue_30d";
  if (overdue >= 14) return "overdue_14d";
  if (overdue >= 7) return "overdue_7d";
  if (overdue === 0) return "due_today";
  if (overdue === -3) return "due_3d";
  if (today === inv.issue_date) return "issued";
  return null;
}
export function isOverdue(inv: { status: string; due_date: string }, today: string) {
  return (inv.status === "sent" || inv.status === "overdue") && inv.due_date < today;
}

/** Usage warning level for storage. 100% blocks new uploads but never existing records. */
export function storageLevel(usedBytes: number, allowanceGb: number) {
  const pct = allowanceGb > 0 ? (usedBytes / (allowanceGb * 1024 ** 3)) * 100 : 100;
  return { pct: r2(pct), level: pct >= 100 ? "full" : pct >= 90 ? "critical" : pct >= 80 ? "warning" : "ok" } as const;
}
