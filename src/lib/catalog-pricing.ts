import { cadencePrices } from "./platform";

export type BillingCadence = "monthly" | "quarterly" | "yearly";

export const CADENCES: { key: BillingCadence; label: string; badge?: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly", badge: "-10%" },
  { key: "yearly", label: "Yearly", badge: "-20%" },
];

export type PricedItem = {
  monthly_price: number | null;
  quarterly_price: number | null;
  yearly_price: number | null;
};

/**
 * Price for a cadence. Uses the catalogue's saved price when present; otherwise
 * derives it from the monthly price with the standard 10% quarterly / 20% yearly discounts.
 */
export function priceForCadence(item: PricedItem, cadence: BillingCadence): number | null {
  const monthly = item.monthly_price != null ? Number(item.monthly_price) : null;
  const saved =
    cadence === "monthly" ? item.monthly_price : cadence === "quarterly" ? item.quarterly_price : item.yearly_price;
  if (saved != null) return Number(saved);
  if (monthly == null) return null;
  const derived = cadencePrices(monthly * 12, 10, 20);
  return cadence === "monthly" ? derived.monthly_price : cadence === "quarterly" ? derived.quarterly_price : derived.yearly_price;
}

export function cadenceSuffix(cadence: BillingCadence): string {
  return cadence === "monthly" ? "/mo" : cadence === "quarterly" ? "/qtr" : "/yr";
}

export function formatEur(n: number | null): string {
  if (n == null) return "—";
  return `€${Number.isInteger(n) ? n.toLocaleString("en-IE") : n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
