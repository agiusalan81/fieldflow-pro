import { TRADES } from "./price-list";
import { SERVICE_GROUPS, expandServices } from "./operating-services";

export type SurveyContact = { id: string; name: string; position: string; email: string; phone: string };
export type SurveyObservation = { id: string; area: string; trade: string; notes: string; photos: string[]; urgency?: string; caption?: string };
export type SurveyDetails = {
  clientName: string; siteName: string; address: string; storeCode: string;
  contacts: SurveyContact[]; trades: string[]; observations: SurveyObservation[];
  /** Field user confirmed no materials/equipment are needed. */
  materialsNA?: boolean;
};
export type TradeDecision = "in_house" | "subcontract" | "exclude";
export type TradeReview = Record<string, { decision: TradeDecision | ""; notes: string }>;
export const WORKING_WINDOWS = ["Weekdays 08:00–17:00", "Weekdays after 18:00", "Weekends only", "Night works 22:00–06:00", "Early mornings 06:00–08:30", "24/7", "Appointment required"];
export function parseSurveyDetails(value: unknown): SurveyDetails {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SurveyDetails> : {};
  return { clientName: v.clientName ?? "", siteName: v.siteName ?? "", address: v.address ?? "", storeCode: v.storeCode ?? "", contacts: Array.isArray(v.contacts) ? v.contacts : [], trades: Array.isArray(v.trades) ? v.trades : [], observations: Array.isArray(v.observations) ? v.observations : [], materialsNA: v.materialsNA === true };
}
export function surveyTradeLabel(trade: string) { return SERVICE_GROUPS.map(g => g.items.find(t => t[0] === trade)?.[1]).find(Boolean) ?? TRADES.find(t => t.key === trade)?.label ?? trade; }
export function surveyTradeOptions(companyTrades: string[]) {
  return expandServices(companyTrades.length ? companyTrades : SERVICE_GROUPS.flatMap(g => g.items.map(t => t[0]))).filter(t => t !== 'custom').map(key => ({ key, label: surveyTradeLabel(key) }));
}
export function addSurveyTrade(trades: string[], trade: string): string[] {
  const name = trade.trim();
  return !name || trades.some(t => t.toLowerCase() === name.toLowerCase()) ? trades : [...trades, name];
}
export function groupSurveyObservations(details: SurveyDetails) {
  return [...new Set([...details.trades, ...details.observations.map(o => o.trade)])].map(trade => ({ trade, label: trade ? surveyTradeLabel(trade) : 'General / site', observations: details.observations.filter(o => o.trade === trade) }));
}
export function surveyReviewerOptions<T extends { role: string }>(team: T[], manager: boolean): T[] {
  return manager ? team : team.filter(m => m.role === "supervisor");
}
export const ACCESS_SUGGESTIONS = ["Key from reception / caretaker", "Parking available on site", "No parking — loading bay only", "Lift access to all floors", "Stairs only — no goods lift", "Escort required on site", "Induction required before work", "Restricted hours — tenants present", "Machine room via roof hatch", "Permit to work required"];
/** Materials/equipment are complete when listed with names, or explicitly marked not applicable. */
export function surveyItemsPending(materials: { label: string }[], other: { label: string }[], details: Pick<SurveyDetails, "materialsNA">) {
  const all = [...materials, ...other];
  if (all.some(i => !i.label.trim())) return true;
  return all.length === 0 && !details.materialsNA;
}
export function canSubmitSurvey(s: { client_id: string | null; site_id: string | null; scope_summary: string | null }, details: SurveyDetails) {
  return Boolean((s.client_id || details.clientName.trim()) && (s.site_id || (details.siteName.trim() && details.address.trim())) && s.scope_summary?.trim());
}