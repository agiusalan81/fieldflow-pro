import { TRADES } from "./price-list";

export type SurveyContact = { id: string; name: string; position: string; email: string; phone: string };
export type SurveyObservation = { id: string; area: string; trade: string; notes: string; photos: string[] };
export type SurveyDetails = {
  clientName: string; siteName: string; address: string; storeCode: string;
  contacts: SurveyContact[]; trades: string[]; observations: SurveyObservation[];
};
export type TradeDecision = "in_house" | "subcontract" | "exclude";
export type TradeReview = Record<string, { decision: TradeDecision | ""; notes: string }>;
export const WORKING_WINDOWS = ["Weekdays 08:00–17:00", "Weekdays after 18:00", "Weekends only", "Night works 22:00–06:00", "Early mornings 06:00–08:30", "24/7", "Appointment required"];
export function parseSurveyDetails(value: unknown): SurveyDetails {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SurveyDetails> : {};
  return { clientName: v.clientName ?? "", siteName: v.siteName ?? "", address: v.address ?? "", storeCode: v.storeCode ?? "", contacts: Array.isArray(v.contacts) ? v.contacts : [], trades: Array.isArray(v.trades) ? v.trades : [], observations: Array.isArray(v.observations) ? v.observations : [] };
}
export function surveyTradeLabel(trade: string) { return TRADES.find(t => t.key === trade)?.label ?? trade; }
export function addSurveyTrade(trades: string[], trade: string): string[] {
  const name = trade.trim();
  return !name || trades.some(t => t.toLowerCase() === name.toLowerCase()) ? trades : [...trades, name];
}
export function groupSurveyObservations(details: SurveyDetails) {
  return details.trades.map(trade => ({ trade, label: surveyTradeLabel(trade), observations: details.observations.filter(o => o.trade === trade) }));
}
export function surveyReviewerOptions<T extends { role: string }>(team: T[], manager: boolean): T[] {
  return manager ? team : team.filter(m => m.role === "supervisor");
}
export function canSubmitSurvey(s: { client_id: string | null; site_id: string | null; scope_summary: string | null }, details: SurveyDetails) {
  return Boolean((s.client_id || details.clientName.trim()) && (s.site_id || (details.siteName.trim() && details.address.trim())) && s.scope_summary?.trim());
}