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

/** Invoice totals in the payment provider's smallest unit (cents). */
export function toMinorUnits(total: number) { return Math.round(Number(total) * 100); }
/** A payment settles an invoice only when currency and exact amount match. */
export function paymentMatches(inv: { total: number | string; currency: string }, amountMinor: number | null | undefined, currency: string | null | undefined) {
  return amountMinor === toMinorUnits(Number(inv.total)) && (currency ?? "").toLowerCase() === inv.currency.toLowerCase();
}
/** Invoices a company can pay online. */
export const PAYABLE_STATUSES = ["sent", "overdue", "suspended"] as const;
export function isPayable(inv: { status: string; total: number | string }) {
  return (PAYABLE_STATUSES as readonly string[]).includes(inv.status) && Number(inv.total) > 0;
}
/** Unpaid issued invoice more than this many days past due makes the company read-only. */
export const READ_ONLY_AFTER_DAYS = 14;
export function isLapsed(inv: { status: string; due_date: string }, today: string) {
  if (!(PAYABLE_STATUSES as readonly string[]).includes(inv.status)) return false;
  const d = new Date(`${inv.due_date}T00:00:00Z`).getTime() + READ_ONLY_AFTER_DAYS * 86400000;
  return new Date(`${today}T00:00:00Z`).getTime() > d;
}
/** Upgrades apply now; downgrades (lower package price) wait for the next renewal. */
export function classifyChange(oldPrice: number, newPrice: number): "upgrade" | "downgrade" | "same" {
  return newPrice > oldPrice ? "upgrade" : newPrice < oldPrice ? "downgrade" : "same";
}
/** Net amount for the rest of the current period after an upgrade, counting `today` as a remaining day. */
export function upgradeProration(oldPrice: number, newPrice: number, periodStart: string, periodEnd: string, today: string) {
  const ms = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const total = Math.round((ms(periodEnd) - ms(periodStart)) / 86400000) + 1;
  const left = Math.round((ms(periodEnd) - ms(today)) / 86400000) + 1;
  if (newPrice <= oldPrice || total <= 0 || left <= 0) return { days_left: Math.max(0, left), period_days: total, amount: 0 };
  return { days_left: Math.min(left, total), period_days: total, amount: r2((newPrice - oldPrice) * Math.min(left, total) / total) };
}
/** The next renewal invoice is prepared 7 days before the current period ends. */
export const RENEWAL_LEAD_DAYS = 7;
export function renewalDue(lastPeriodEnd: string, today: string) {
  return new Date(`${today}T00:00:00Z`).getTime() >= new Date(`${lastPeriodEnd}T00:00:00Z`).getTime() - RENEWAL_LEAD_DAYS * 86400000;
}
