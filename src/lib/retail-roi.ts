import type { PublicCatalogItem } from "./public-catalog.functions";
import { priceForCadence, type BillingCadence } from "./catalog-pricing";

export type RoiInputs = { technicians: number; stores: number; days: number; minutes: number; hourlyRate: number; comparisonPerSeat: number | null; setupCost: number };
const safe = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
export function retailRoi(input: RoiInputs, plan: PublicCatalogItem, cadence: BillingCadence) {
  const price = priceForCadence(plan, cadence);
  const annualCost = (price ?? 0) * (cadence === "monthly" ? 12 : cadence === "quarterly" ? 4 : 1);
  const fits = safe(input.technicians) <= plan.included_seats;
  const hours = safe(input.technicians) * safe(input.minutes) / 60 * safe(input.days);
  const annualCapacity = hours * safe(input.hourlyRate) * 12;
  const comparison = input.comparisonPerSeat === null ? null : safe(input.comparisonPerSeat) * safe(input.technicians) * 12;
  const licenceDifference = comparison === null ? null : comparison - annualCost;
  const net = annualCapacity + (comparison ?? 0) - annualCost - safe(input.setupCost);
  return { fits, annualCost, hours, annualCapacity, licenceDifference, net, roi: annualCost + safe(input.setupCost) > 0 ? net / (annualCost + safe(input.setupCost)) * 100 : null };
}